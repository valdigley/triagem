// Cloudflare Workers entry point
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Get the asset from Cloudflare Pages
    const response = await env.ASSETS.fetch(request);
    
    // Clone the response to modify headers
    const newResponse = new Response(response.body, response);
    
    // Set correct MIME types based on file extension
    const pathname = url.pathname;
    
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
    
    // Handle SPA routing - serve index.html for non-asset requests
    if (response.status === 404 && !pathname.includes('.')) {
      const indexRequest = new Request(new URL('/index.html', request.url), request);
      const indexResponse = await env.ASSETS.fetch(indexRequest);
      const indexNewResponse = new Response(indexResponse.body, indexResponse);
      indexNewResponse.headers.set('Content-Type', 'text/html');
      return indexNewResponse;
    }
    
    return newResponse;
  },
};