import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface FTPMonitorRequest {
  photographer_id?: string;
  force_scan?: boolean;
}

interface FTPConfig {
  host: string;
  username: string;
  password: string;
  port: number;
  monitor_path: string;
  auto_upload: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('FTP monitor function called');

  try {
    const { photographer_id, force_scan }: FTPMonitorRequest = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar configurações FTP de todos os fotógrafos ou de um específico
    let query = supabase
      .from('api_access')
      .select(`
        *,
        photographers!inner(
          id,
          business_name,
          user_id
        )
      `)
      .not('ftp_config', 'is', null);

    if (photographer_id) {
      query = query.eq('photographers.id', photographer_id);
    }

    const { data: ftpConfigs, error } = await query;

    if (error) {
      console.error('Error fetching FTP configs:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configurações FTP' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!ftpConfigs || ftpConfigs.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Nenhuma configuração FTP encontrada',
          processed: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${ftpConfigs.length} FTP configurations to monitor`);

    let totalProcessed = 0;
    const results = [];

    // Processar cada configuração FTP
    for (const config of ftpConfigs) {
      try {
        const result = await processFTPConfig(config, supabase);
        results.push(result);
        totalProcessed += result.photosProcessed;
      } catch (error) {
        console.error(`Error processing FTP config for photographer ${config.photographers.id}:`, error);
        results.push({
          photographerId: config.photographers.id,
          error: error.message,
          photosProcessed: 0
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed,
        results,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in FTP monitor:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function processFTPConfig(config: any, supabase: any) {
  const ftpConfig: FTPConfig = config.ftp_config;
  const photographerId = config.photographers.id;
  
  console.log(`Processing FTP for photographer ${photographerId}:`, {
    host: ftpConfig.host,
    username: ftpConfig.username,
    monitor_path: ftpConfig.monitor_path,
    auto_upload: ftpConfig.auto_upload
  });

  if (!ftpConfig.auto_upload) {
    console.log('Auto upload disabled for this photographer');
    return {
      photographerId,
      message: 'Auto upload desabilitado',
      photosProcessed: 0
    };
  }

  // Simular conexão FTP e listagem de arquivos
  // Em produção, você usaria uma biblioteca FTP real
  const mockFiles = await simulateFTPListing(ftpConfig);
  
  if (mockFiles.length === 0) {
    return {
      photographerId,
      message: 'Nenhum arquivo novo encontrado',
      photosProcessed: 0
    };
  }

  // Buscar álbuns ativos do fotógrafo
  const { data: activeAlbums } = await supabase
    .from('albums')
    .select(`
      *,
      events!inner(photographer_id)
    `)
    .eq('events.photographer_id', photographerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!activeAlbums || activeAlbums.length === 0) {
    return {
      photographerId,
      message: 'Nenhum álbum ativo encontrado',
      photosProcessed: 0
    };
  }

  // Usar o álbum mais recente por padrão
  const targetAlbum = activeAlbums[0];
  console.log(`Using album: ${targetAlbum.name} (${targetAlbum.id})`);

  let photosProcessed = 0;

  // Processar cada arquivo
  for (const file of mockFiles) {
    try {
      const photoData = await processPhotoFile(file, targetAlbum.id, ftpConfig);
      
      const { error: insertError } = await supabase
        .from('photos')
        .insert(photoData);

      if (insertError) {
        console.error(`Error inserting photo ${file.name}:`, insertError);
      } else {
        console.log(`Photo ${file.name} added to album ${targetAlbum.name}`);
        photosProcessed++;
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }

  // Atualizar log de atividade do álbum
  if (photosProcessed > 0) {
    try {
      const { data: currentAlbum } = await supabase
        .from('albums')
        .select('activity_log')
        .eq('id', targetAlbum.id)
        .single();

      const currentLog = currentAlbum?.activity_log || [];
      const newActivity = {
        timestamp: new Date().toISOString(),
        type: 'ftp_upload',
        description: `${photosProcessed} fotos adicionadas automaticamente via FTP`
      };

      await supabase
        .from('albums')
        .update({ 
          activity_log: [...currentLog, newActivity]
        })
        .eq('id', targetAlbum.id);
    } catch (error) {
      console.error('Error updating activity log:', error);
    }
  }

  return {
    photographerId,
    albumId: targetAlbum.id,
    albumName: targetAlbum.name,
    photosProcessed,
    message: `${photosProcessed} fotos processadas com sucesso`
  };
}

async function simulateFTPListing(ftpConfig: FTPConfig) {
  // SIMULAÇÃO - Em produção, você conectaria ao FTP real
  console.log('Simulating FTP connection to:', ftpConfig.host);
  
  // Simular arquivos encontrados
  const mockFiles = [
    {
      name: 'DSC_0001.jpg',
      size: 2048000,
      lastModified: new Date(),
      path: `${ftpConfig.monitor_path}/DSC_0001.jpg`
    },
    {
      name: 'DSC_0002.jpg', 
      size: 1856000,
      lastModified: new Date(),
      path: `${ftpConfig.monitor_path}/DSC_0002.jpg`
    }
  ];

  // Filtrar apenas arquivos de imagem
  return mockFiles.filter(file => 
    /\.(jpg|jpeg|png|gif|bmp|tiff)$/i.test(file.name)
  );
}

async function processPhotoFile(file: any, albumId: string, ftpConfig: FTPConfig) {
  console.log(`Processing photo: ${file.name}`);

  // Gerar URLs simuladas (em produção, você faria upload real)
  const photoId = `ftp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    album_id: albumId,
    filename: file.name,
    original_path: `https://picsum.photos/800/600?random=${photoId}`,
    thumbnail_path: `https://picsum.photos/300/200?random=${photoId}`,
    watermarked_path: `https://picsum.photos/800/600?random=${photoId}`,
    is_selected: false,
    price: 25.00,
    metadata: {
      source: 'ftp_auto_upload',
      ftp_path: file.path,
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
      processed_by: 'ftp_monitor'
    }
  };
}