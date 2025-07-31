import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface GetUsersRequest {
  user_ids: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('Get users by IDs function called');

  try {
    const { user_ids }: GetUsersRequest = await req.json()

    console.log('Requested user IDs:', user_ids);

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'user_ids array is required' }),
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

    // Fetch user data for each ID
    const users = await Promise.all(
      user_ids.map(async (userId) => {
        try {
          const { data, error } = await supabase.auth.admin.getUserById(userId)
          
          if (error) {
            console.error(`Error fetching user ${userId}:`, error)
            return {
              id: userId,
              email: 'Email não encontrado',
              name: 'Nome não encontrado',
              error: error.message
            }
          }

          return {
            id: userId,
            email: data.user?.email || 'Email não encontrado',
            name: data.user?.user_metadata?.name || 
                  data.user?.user_metadata?.full_name || 
                  data.user?.email?.split('@')[0] || 
                  'Nome não encontrado'
          }
        } catch (error) {
          console.error(`Exception fetching user ${userId}:`, error)
          return {
            id: userId,
            email: 'Email não encontrado',
            name: 'Nome não encontrado',
            error: error.message
          }
        }
      })
    )

    console.log('Users fetched successfully:', users.length);

    return new Response(
      JSON.stringify({ users }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in get-users-by-ids function:', error)
    
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