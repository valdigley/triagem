// Cloudflare Workers entry point for SPA routing
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    console.log('Workers request:', pathname);
    
    // Handle SPA routes first (before trying to fetch assets)
    const spaRoutes = ['/agendar', '/album'];
    const isSpaRoute = spaRoutes.some(route => pathname.startsWith(route)) || pathname === '/';
    
    // Try to get the asset first
    let response;
    
    try {
      response = await env.ASSETS.fetch(request);
    } catch (error) {
      console.error('Asset fetch error:', error);
      response = new Response('Asset not found', { status: 404 });
    }
    
    // If asset exists and it's not a SPA route, serve it
    if (response.status === 200 && !isSpaRoute) {
      const newResponse = new Response(response.body, response);
      
      // Set correct MIME types
      if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
        newResponse.headers.set('Content-Type', 'application/javascript; charset=utf-8');
      } else if (pathname.endsWith('.css')) {
        newResponse.headers.set('Content-Type', 'text/css; charset=utf-8');
      } else if (pathname.endsWith('.html')) {
        newResponse.headers.set('Content-Type', 'text/html; charset=utf-8');
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
    
    // For SPA routes or 404 assets that look like routes, serve index.html
    if (isSpaRoute || (response.status === 404 && !pathname.includes('.'))) {
      console.log('Serving index.html for SPA route:', pathname);
      
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
          
          console.log('Successfully served index.html for:', pathname);
          return indexNewResponse;
        } else {
          console.error('Failed to fetch index.html:', indexResponse.status);
        }
      } catch (error) {
        console.error('Error serving index.html:', error);
      }
    }
    
    // Return original response for everything else
    console.log('Returning original response for:', pathname, 'Status:', response.status);
    return response;
  },
};