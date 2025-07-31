// Cloudflare Workers entry point for SPA routing
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    console.log('Workers request:', pathname);
    
    // Get the asset from Cloudflare Workers Assets
    let response;
    
    try {
      response = await env.ASSETS.fetch(request);
    } catch (error) {
      console.error('Asset fetch error:', error);
      response = new Response('Asset not found', { status: 404 });
    }
    
    // If asset exists, serve it with correct headers
    if (response.status === 200) {
      const newResponse = new Response(response.body, response);
      
      // Set correct MIME types
      if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
        newResponse.headers.set('Content-Type', 'application/javascript');
      } else if (pathname.endsWith('.css')) {
        newResponse.headers.set('Content-Type', 'text/css');
      } else if (pathname.endsWith('.html')) {
        newResponse.headers.set('Content-Type', 'text/html');
      } else if (pathname.endsWith('.json')) {
        newResponse.headers.set('Content-Type', 'application/json');
      } else if (pathname.endsWith('.svg')) {
        newResponse.headers.set('Content-Type', 'image/svg+xml');
      } else if (pathname.endsWith('.png')) {
        newResponse.headers.set('Content-Type', 'image/png');
      } else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
        newResponse.headers.set('Content-Type', 'image/jpeg');
      } else if (pathname.endsWith('.ico')) {
        newResponse.headers.set('Content-Type', 'image/x-icon');
      }
      
      return newResponse;
    }
    
    // For SPA routes (404 for non-asset requests), serve index.html
    if (response.status === 404 && !pathname.includes('.')) {
      console.log('SPA route detected, serving index.html for:', pathname);
      
      // Special handling for SPA routes
      const spaRoutes = ['/agendar', '/album'];
      const isSpaRoute = spaRoutes.some(route => pathname.startsWith(route)) || pathname === '/';
      
      if (isSpaRoute) {
        try {
          const indexRequest = new Request(new URL('/index.html', request.url), {
            method: 'GET',
            headers: request.headers,
          });
          
          const indexResponse = await env.ASSETS.fetch(indexRequest);
          
          if (indexResponse.ok) {
            const indexNewResponse = new Response(indexResponse.body, {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
              }
            });
            
            console.log('Served index.html for SPA route:', pathname);
            return indexNewResponse;
          }
        } catch (error) {
          console.error('Error serving index.html:', error);
        }
      }
    }
    
    // Return original response for everything else
    return response;
  },
};