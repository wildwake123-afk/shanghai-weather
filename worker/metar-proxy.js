// Cloudflare Worker - METAR CORS Proxy
// Deploy at: https://dash.cloudflare.com/ → Workers & Pages → Create Application → Create Worker
// Then update app.js METAR_API to: 'https://YOUR-WORKER-SUBDOMAIN.workers.dev/metar'

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // 只允许 /metar 路径
    if (!url.pathname.startsWith('/metar')) {
      return new Response('Not found', { status: 404 });
    }
    
    // 数据源：NOAA METAR
    const metarUrl = 'https://tgftp.nws.noaa.gov/data/observations/metar/stations/ZSPD.TXT';
    
    try {
      const response = await fetch(metarUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WeatherApp/1.0)',
          'Accept': 'text/plain',
        }
      });
      
      if (!response.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch METAR' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const text = await response.text();
      const lines = text.trim().split('\n');
      
      if (lines.length < 2) {
        return new Response(JSON.stringify({ error: 'Invalid METAR data' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const dateStr = lines[0].trim();
      const rawMetar = lines[1].trim();
      
      // 返回 JSON + CORS 头
      return new Response(JSON.stringify({
        station: 'ZSPD',
        date: dateStr,
        rawOb: rawMetar,
        source: 'NOAA METAR'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-store',
        }
      });
      
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
