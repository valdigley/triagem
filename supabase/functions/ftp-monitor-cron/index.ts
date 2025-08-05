import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('FTP monitor cron job triggered');

  try {
    // Chamar a função de monitoramento FTP
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ftp-monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        force_scan: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro no monitoramento FTP');
    }

    const result = await response.json();
    console.log('FTP monitor cron result:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'FTP monitoring completed',
        result,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in FTP monitor cron:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro no cron job de monitoramento FTP', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});