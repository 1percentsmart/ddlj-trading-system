/**
 * DDLJ Trading System — API Proxy Route
 * ==========================================
 * Proxies all /api/v1/* requests to the FastAPI backend.
 * This is CRITICAL — without it, the frontend can't reach the backend.
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://ddlj.up.railway.app';

async function proxyRequest(request: Request, path: string[]) {
  const targetUrl = `${BACKEND_URL}/api/v1/${path.join('/')}`;
  const url = new URL(request.url);

  // Forward query parameters
  const targetWithQuery = `${targetUrl}${url.search}`;

  // Forward all headers except host
  const headers = new Headers(request.headers);
  headers.delete('host');

  try {
    const response = await fetch(targetWithQuery, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined,
    });

    // Clone the response with CORS headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Backend unreachable', detail: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PUT(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
