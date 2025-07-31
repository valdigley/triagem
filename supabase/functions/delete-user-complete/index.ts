import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DeleteUserRequest {
  user_id: string;
  subscription_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('Delete user complete function called');

  try {
    const { user_id, subscription_id }: DeleteUserRequest = await req.json()

    console.log('Delete user request:', {
      user_id,
      subscription_id
    });

    if (!user_id || !subscription_id) {
      return new Response(
        JSON.stringify({ error: 'user_id and subscription_id are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create admin client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting complete user deletion process...');

    // 1. Buscar dados do fotógrafo para obter álbuns e fotos
    const { data: photographer } = await supabase
      .from('photographers')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (photographer) {
      console.log('Found photographer profile:', photographer.id);

      // 2. Buscar eventos do fotógrafo
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('photographer_id', photographer.id);

      if (events && events.length > 0) {
        console.log(`Found ${events.length} events to delete`);

        // 3. Buscar álbuns dos eventos
        const eventIds = events.map(e => e.id);
        const { data: albums } = await supabase
          .from('albums')
          .select('id')
          .in('event_id', eventIds);

        if (albums && albums.length > 0) {
          console.log(`Found ${albums.length} albums to delete`);

          // 4. Buscar fotos dos álbuns
          const albumIds = albums.map(a => a.id);
          const { data: photos } = await supabase
            .from('photos')
            .select('original_path, thumbnail_path, watermarked_path')
            .in('album_id', albumIds);

          if (photos && photos.length > 0) {
            console.log(`Found ${photos.length} photos to delete from storage`);

            // 5. Excluir fotos do Storage
            const filesToDelete: string[] = [];
            
            photos.forEach(photo => {
              if (photo.original_path && photo.original_path.includes('/photos/')) {
                const originalFile = photo.original_path.split('/photos/')[1];
                if (originalFile) filesToDelete.push(originalFile);
              }
              
              if (photo.thumbnail_path && photo.thumbnail_path.includes('/photos/')) {
                const thumbnailFile = photo.thumbnail_path.split('/photos/')[1];
                if (thumbnailFile && !filesToDelete.includes(thumbnailFile)) {
                  filesToDelete.push(thumbnailFile);
                }
              }
              
              if (photo.watermarked_path && photo.watermarked_path.includes('/photos/')) {
                const watermarkedFile = photo.watermarked_path.split('/photos/')[1];
                if (watermarkedFile && !filesToDelete.includes(watermarkedFile)) {
                  filesToDelete.push(watermarkedFile);
                }
              }
            });

            if (filesToDelete.length > 0) {
              console.log(`Deleting ${filesToDelete.length} files from storage`);
              
              const { error: storageError } = await supabase.storage
                .from('photos')
                .remove(filesToDelete);

              if (storageError) {
                console.error('Error deleting files from storage:', storageError);
                // Continue even if storage deletion fails
              } else {
                console.log('Files deleted from storage successfully');
              }
            }
          }
        }
      }
    }

    // 6. Excluir usuário do Auth (isso vai cascatear para todas as tabelas relacionadas)
    console.log('Deleting user from auth...');
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user_id);

    if (authDeleteError) {
      console.error('Error deleting user from auth:', authDeleteError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete user from auth', 
          details: authDeleteError 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User deleted from auth successfully');

    // 7. Log da exclusão
    await supabase.from('webhook_logs').insert({
      event_type: 'user_deleted_by_master',
      payload: {
        deleted_user_id: user_id,
        subscription_id: subscription_id,
        deleted_at: new Date().toISOString(),
        deleted_by: 'master_user'
      },
      status: 'success'
    });

    console.log('=== USER DELETION COMPLETED ===');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User and all related data deleted successfully',
        deleted_user_id: user_id,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in delete-user-complete function:', error)
    
    // Log error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase.from('webhook_logs').insert({
        event_type: 'user_deletion_error',
        payload: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        status: 'failed'
      });
    } catch (logError) {
      console.error('Failed to log deletion error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})