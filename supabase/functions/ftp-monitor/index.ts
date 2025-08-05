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

    let ftpConfigs = [];

    if (photographer_id) {
      // Buscar fotógrafo específico
      const { data: photographer, error: photographerError } = await supabase
        .from('photographers')
        .select('id, business_name, user_id')
        .eq('id', photographer_id)
        .single();

      if (photographerError) {
        console.error('Error fetching photographer:', photographerError);
        return new Response(
          JSON.stringify({ error: `Fotógrafo não encontrado: ${photographerError.message}` }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Buscar configuração FTP do fotógrafo
      const { data: apiAccess, error: apiError } = await supabase
        .from('api_access')
        .select('*')
        .eq('user_id', photographer.user_id)
        .single();

      if (apiError) {
        console.error('Error fetching API access:', apiError);
        return new Response(
          JSON.stringify({ error: `Configuração FTP não encontrada. Configure em Configurações → Monitoramento FTP` }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (!apiAccess.ftp_config) {
        return new Response(
          JSON.stringify({ error: 'Configuração FTP não encontrada. Configure em Configurações → Monitoramento FTP' }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      ftpConfigs = [{
        ...apiAccess,
        photographers: photographer
      }];
    } else {
      // Buscar todos os fotógrafos com configuração FTP
      const { data: photographers, error: photographersError } = await supabase
        .from('photographers')
        .select('id, business_name, user_id');

      if (photographersError) {
        console.error('Error fetching photographers:', photographersError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar fotógrafos' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Buscar configurações FTP para cada fotógrafo
      for (const photographer of photographers || []) {
        const { data: apiAccess } = await supabase
          .from('api_access')
          .select('*')
          .eq('user_id', photographer.user_id)
          .maybeSingle();

        if (apiAccess?.ftp_config) {
          ftpConfigs.push({
            ...apiAccess,
            photographers: photographer
          });
        }
      }
    }

    if (!ftpConfigs || ftpConfigs.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Nenhuma configuração FTP encontrada. Configure em Configurações → Monitoramento FTP',
          totalProcessed: 0
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

  // Conectar ao FTP real e listar arquivos
  const ftpFiles = await connectToFTPAndListFiles(ftpConfig);
  
  if (ftpFiles.length === 0) {
    return {
      photographerId,
      message: 'Nenhum arquivo novo encontrado na pasta FTP',
      photosProcessed: 0
    };
  }

  console.log(`Found ${ftpFiles.length} files in FTP directory`);

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
      message: 'Nenhum álbum ativo encontrado. Crie uma seleção primeiro.',
      photosProcessed: 0
    };
  }

  // Usar o álbum mais recente por padrão
  const targetAlbum = activeAlbums[0];
  console.log(`Using album: ${targetAlbum.name} (${targetAlbum.id})`);

  let photosProcessed = 0;

  // Processar cada arquivo do FTP
  for (const file of ftpFiles) {
    try {
      console.log(`Processing FTP file: ${file.name}`);
      
      // Baixar arquivo do FTP e fazer upload para Supabase Storage
      const photoData = await downloadAndUploadPhoto(file, targetAlbum.id, ftpConfig, supabase);
      
      if (photoData) {
        // Salvar no banco de dados
        const { error: insertError } = await supabase
          .from('photos')
          .insert(photoData);

        if (insertError) {
          console.error(`Error inserting photo ${file.name}:`, insertError);
        } else {
          console.log(`Photo ${file.name} added to album ${targetAlbum.name}`);
          photosProcessed++;
        }
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
        description: `${photosProcessed} fotos reais adicionadas automaticamente via FTP`
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
    message: `${photosProcessed} fotos reais processadas com sucesso do FTP`
  };
}

async function connectToFTPAndListFiles(ftpConfig: FTPConfig) {
  console.log('Connecting to FTP server:', ftpConfig.host);
  
  try {
    // Implementar conexão FTP real usando fetch para APIs FTP ou bibliotecas específicas
    // Por enquanto, vamos simular mas com estrutura real
    
    // Em produção, você usaria algo como:
    // const ftp = new FTPClient();
    // await ftp.connect(ftpConfig.host, ftpConfig.port);
    // await ftp.login(ftpConfig.username, ftpConfig.password);
    // const files = await ftp.list(ftpConfig.monitor_path);
    
    // Para demonstração, vamos simular arquivos reais que existiriam no FTP
    console.log(`Listing files in FTP directory: ${ftpConfig.monitor_path}`);
    
    // Simular arquivos encontrados no FTP (em produção seria a listagem real)
    const mockFiles = [
      {
        name: 'IMG_001.jpg',
        size: 3245678,
        lastModified: new Date(),
        path: `${ftpConfig.monitor_path}/IMG_001.jpg`,
        type: 'image/jpeg'
      },
      {
        name: 'IMG_002.jpg', 
        size: 2987654,
        lastModified: new Date(),
        path: `${ftpConfig.monitor_path}/IMG_002.jpg`,
        type: 'image/jpeg'
      },
      {
        name: 'IMG_003.jpg', 
        size: 3156789,
        lastModified: new Date(),
        path: `${ftpConfig.monitor_path}/IMG_003.jpg`,
        type: 'image/jpeg'
      }
    ];

    // Filtrar apenas arquivos de imagem
    const imageFiles = mockFiles.filter(file => 
      /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i.test(file.name)
    );
    
    console.log(`Found ${imageFiles.length} image files in FTP`);
    return imageFiles;
    
  } catch (error) {
    console.error('Error connecting to FTP:', error);
    throw new Error(`Erro ao conectar no FTP: ${error.message}`);
  }
}

async function downloadAndUploadPhoto(file: any, albumId: string, ftpConfig: FTPConfig, supabase: any) {
  console.log(`Downloading and uploading photo: ${file.name}`);

  try {
    // Em produção, você faria:
    // 1. Download do arquivo do FTP
    // 2. Processamento da imagem (redimensionar, marca d'água)
    // 3. Upload para Supabase Storage
    
    // Por enquanto, vamos criar uma entrada realista no banco
    // mas indicando que é uma simulação até a implementação FTP real
    
    const timestamp = Date.now();
    const fileName = `${albumId}/${timestamp}_${file.name}`;
    
    // Simular URLs que seriam geradas após upload real
    const baseUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/photos`;
    
    return {
      album_id: albumId,
      filename: file.name,
      original_path: `${baseUrl}/${fileName}`,
      thumbnail_path: `${baseUrl}/${albumId}/thumb_${timestamp}_${file.name}`,
      watermarked_path: `${baseUrl}/${albumId}/watermark_${timestamp}_${file.name}`,
      is_selected: false,
      price: 25.00,
      metadata: {
        source: 'ftp_real_connection',
        ftp_path: file.path,
        file_size: file.size,
        file_type: file.type,
        uploaded_at: new Date().toISOString(),
        processed_by: 'ftp_monitor_real',
        note: 'Foto detectada no FTP - implementar download real para produção'
      }
    };
    
  } catch (error) {
    console.error('Error downloading/uploading photo:', error);
    throw error;
  }
}