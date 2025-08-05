import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== FTP MONITOR CRON JOB STARTED ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Buscar todos os fotógrafos com FTP configurado e ativo
    console.log('🔍 Searching for photographers with active FTP monitoring...');
    
    const { data: apiAccessList, error: apiError } = await supabase
      .from('api_access')
      .select(`
        user_id,
        ftp_config,
        photographers!inner(id, business_name)
      `)
      .not('ftp_config', 'is', null);

    if (apiError) {
      console.error('Error fetching API access configs:', apiError);
      throw new Error(`Database error: ${apiError.message}`);
    }

    if (!apiAccessList || apiAccessList.length === 0) {
      console.log('📭 No photographers with FTP configuration found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No FTP configurations found',
          photographersScanned: 0,
          totalPhotosAdded: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`👥 Found ${apiAccessList.length} photographers with FTP config`);

    let totalPhotosAdded = 0;
    const scanResults = [];

    // 2. Para cada fotógrafo, verificar se tem álbuns com FTP ativo
    for (const apiAccess of apiAccessList) {
      const photographer = apiAccess.photographers;
      const ftpConfig = apiAccess.ftp_config;

      console.log(`\n📸 Processing photographer: ${photographer.business_name}`);

      // Verificar se o monitoramento automático está ativo
      if (!ftpConfig.auto_upload) {
        console.log(`⏸️ Auto upload disabled for ${photographer.business_name}`);
        continue;
      }

      // Buscar álbuns ativos com FTP habilitado
      const { data: albums, error: albumsError } = await supabase
        .from('albums')
        .select(`
          *,
          events!inner(photographer_id)
        `)
        .eq('events.photographer_id', photographer.id)
        .eq('is_active', true);

      if (albumsError) {
        console.error(`Error fetching albums for ${photographer.business_name}:`, albumsError);
        continue;
      }

      if (!albums || albums.length === 0) {
        console.log(`📭 No active albums for ${photographer.business_name}`);
        continue;
      }

      // Filtrar álbuns que têm FTP habilitado
      const ftpEnabledAlbums = albums.filter(album => {
        const activityLog = album.activity_log || [];
        const ftpEnabled = activityLog.some(log => 
          log.type === 'ftp_enabled' && 
          !activityLog.some(laterLog => 
            laterLog.type === 'ftp_disabled' && 
            new Date(laterLog.timestamp) > new Date(log.timestamp)
          )
        );
        return ftpEnabled;
      });

      console.log(`📁 Found ${ftpEnabledAlbums.length} albums with FTP enabled`);

      // 3. Para cada álbum com FTP ativo, executar scan
      for (const album of ftpEnabledAlbums) {
        try {
          console.log(`\n🔍 Scanning FTP for album: ${album.name}`);

          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ftp-monitor`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              photographer_id: photographer.id,
              target_album_id: album.id,
              force_scan: false,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error(`❌ FTP scan failed for album ${album.name}:`, errorData);
            scanResults.push({
              photographer: photographer.business_name,
              album: album.name,
              status: 'error',
              error: errorData.error
            });
            continue;
          }

          const result = await response.json();
          console.log(`✅ FTP scan completed for ${album.name}: ${result.photosProcessed} photos`);

          totalPhotosAdded += result.photosProcessed || 0;
          
          scanResults.push({
            photographer: photographer.business_name,
            album: album.name,
            status: 'success',
            photosProcessed: result.photosProcessed || 0,
            message: result.message
          });

        } catch (error) {
          console.error(`❌ Error scanning album ${album.name}:`, error);
          scanResults.push({
            photographer: photographer.business_name,
            album: album.name,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    console.log('\n=== FTP CRON JOB COMPLETED ===');
    console.log(`📊 Total photos added: ${totalPhotosAdded}`);
    console.log(`👥 Photographers scanned: ${apiAccessList.length}`);

    // 4. Log do resultado
    await supabase.from('webhook_logs').insert({
      event_type: 'ftp_cron_completed',
      payload: {
        photographersScanned: apiAccessList.length,
        totalPhotosAdded,
        scanResults,
        timestamp: new Date().toISOString()
      },
      status: totalPhotosAdded > 0 ? 'success' : 'success'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `FTP monitoring completed successfully`,
        photographersScanned: apiAccessList.length,
        totalPhotosAdded,
        scanResults,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('=== FTP CRON JOB ERROR ===');
    console.error('Error details:', error);
    
    // Log do erro
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase.from('webhook_logs').insert({
        event_type: 'ftp_cron_error',
        payload: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        status: 'failed'
      });
    } catch (logError) {
      console.error('Failed to log cron error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro no cron job de monitoramento FTP', 
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});