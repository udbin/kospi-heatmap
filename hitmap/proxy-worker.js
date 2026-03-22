/**
 * Cloudflare Worker — KOSPI Heatmap CORS Proxy
 *
 * 배포 방법:
 * 1. https://dash.cloudflare.com → Workers & Pages → Create Worker
 * 2. 이 코드 붙여넣기 → Deploy
 * 3. 워커 URL 확인 (예: https://kospi-proxy.유저명.workers.dev)
 * 4. index.html의 PROXY_BASE 변수에 해당 URL 입력
 *
 * 무료 플랜: 하루 100,000 요청 (충분함)
 */

const ALLOWED_ORIGINS = [
  // 배포 도메인 추가 (예: 'https://heatmap.example.com')
  // '*' 로 설정 시 모든 출처 허용 (개발 중에는 편리)
  '*'
];

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let upstreamUrl, cacheSeconds;

      if (path === '/quote') {
        // 종목 현재가: /quote?symbols=005930.KS,000660.KS,...
        const symbols = url.searchParams.get('symbols') || '';
        upstreamUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketChangePercent,regularMarketPrice,regularMarketPreviousClose&formatted=false`;
        cacheSeconds = 60; // 1분 캐시

      } else if (path === '/chart') {
        // 지수: /chart?symbol=%5EKS11
        const symbol = url.searchParams.get('symbol') || '';
        upstreamUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        cacheSeconds = 60;

      } else {
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Yahoo Finance 요청
      const upstream = await fetch(upstreamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        cf: { cacheTtl: cacheSeconds, cacheEverything: true },
      });

      if (!upstream.ok) {
        throw new Error(`Yahoo: ${upstream.status}`);
      }

      const data = await upstream.json();

      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': `public, max-age=${cacheSeconds}`,
          'X-Cache-Status': 'MISS',
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
