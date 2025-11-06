import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';

let initialized = false;

async function ensureWasmInitialized() {
  if (!initialized) {
    await initWasm(resvgWasm);
    initialized = true;
  }
}

// データからキャッシュキーを生成
async function generateCacheKey(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    await ensureWasmInitialized();
    const url = new URL(request.url);
    const data = url.searchParams.get('data');
    // vパラメータはキャッシュバスティング用（画像生成には使用しない）

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!data) {
      return new Response('Missing data parameter', {
        status: 400,
        headers: corsHeaders
      });
    }

    // KVキャッシュをチェック
    if (env.OG_IMAGE_CACHE) {
      const cacheKey = await generateCacheKey(data);
      const cachedImage = await env.OG_IMAGE_CACHE.get(cacheKey, 'arrayBuffer');

      if (cachedImage) {
        console.log('Cache hit for key:', cacheKey);
        return new Response(cachedImage, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Cache': 'HIT',
          },
        });
      }
      console.log('Cache miss for key:', cacheKey);
    }

    try {
      // Decode diagram data - handle both encoded and non-encoded data
      let diagramData;
      try {
        // First try parsing without decoding
        diagramData = JSON.parse(data);
      } catch (parseError) {
        // If that fails, try decoding first
        diagramData = JSON.parse(decodeURIComponent(data));
      }

      const { people = [], relationships = [] } = diagramData;

      const scaleX = 1200 / 800;
      const scaleY = 630 / 500;

      // Fetch font for Satori with timeout
      console.log('Fetching font...');
      const fontController = new AbortController();
      const fontTimeout = setTimeout(() => fontController.abort(), 10000);

      const fontResponse = await fetch(
        'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEi75vY0rw-oME.ttf',
        { signal: fontController.signal }
      );
      clearTimeout(fontTimeout);

      if (!fontResponse.ok) {
        throw new Error(`Font fetch failed: ${fontResponse.status}`);
      }

      const fontData = await fontResponse.arrayBuffer();
      console.log('Font loaded, size:', fontData.byteLength);

      // Generate SVG using Satori
      console.log('Generating SVG...');
      const svg = await satori(
        {
          type: 'div',
          props: {
            style: {
              width: '100%',
              height: '100%',
              display: 'flex',
              position: 'relative',
              background: 'linear-gradient(135deg, #fce4ec 0%, #f3e5f5 50%, #e3f2fd 100%)',
            },
            children: [
              // 関係性の線と矢印
              ...relationships.map(rel => {
                const fromPerson = people.find(p => p.id === rel.from);
                const toPerson = people.find(p => p.id === rel.to);
                if (!fromPerson || !toPerson) return null;

                const fromX = fromPerson.x * scaleX;
                const fromY = fromPerson.y * scaleY;
                const toX = toPerson.x * scaleX;
                const toY = toPerson.y * scaleY;

                const angle = Math.atan2(toY - fromY, toX - fromX);
                const avatarRadius = 35 * scaleX; // 元のブラウザコードに合わせる
                const nameHeight = 20 * scaleY;
                const buffer = 10 * scaleY;
                const avoidanceDistance = avatarRadius + nameHeight + buffer;

                const startX = fromX + Math.cos(angle) * avoidanceDistance;
                const startY = fromY + Math.sin(angle) * avoidanceDistance;
                const endX = toX - Math.cos(angle) * avoidanceDistance;
                const endY = toY - Math.sin(angle) * avoidanceDistance;

                const lineLength = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2 - 20 * scaleY;
                const arrowSize = 10 * scaleX;

                return [
                  // 線
                  {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: `${startX}px`,
                        top: `${startY}px`,
                        width: `${lineLength}px`,
                        height: `${2 * scaleY}px`,
                        background: '#666',
                        transform: `rotate(${angle}rad)`,
                        transformOrigin: '0 50%',
                      },
                    },
                  },
                  // 矢印
                  {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: `${endX}px`,
                        top: `${endY}px`,
                        width: 0,
                        height: 0,
                        borderLeft: `${arrowSize}px solid #666`,
                        borderTop: `${arrowSize * 0.67}px solid transparent`,
                        borderBottom: `${arrowSize * 0.67}px solid transparent`,
                        transform: `rotate(${angle}rad) translateX(-${arrowSize}px)`,
                        transformOrigin: '0 50%',
                      },
                    },
                  },
                  // ラベル
                  rel.label ? {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: `${midX}px`,
                        top: `${midY}px`,
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(255, 255, 255, 0.95)',
                        padding: `${6 * scaleY}px ${12 * scaleX}px`,
                        borderRadius: `${6 * scaleX}px`,
                        fontSize: `${14 * scaleX}px`,
                        fontWeight: 'bold',
                        color: '#333',
                        border: `${1 * scaleX}px solid #e0e0e0`,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      },
                      children: rel.label,
                    },
                  } : null,
                ];
              }).filter(Boolean).flat().filter(Boolean),
              // 人物
              ...people.map((person) => {
                const x = person.x * scaleX;
                const y = person.y * scaleY;
                const radius = 35 * scaleX; // 元のブラウザコードに合わせて35px

                return [
                  // 円
                  {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: `${x - radius}px`,
                        top: `${y - radius}px`,
                        width: `${radius * 2}px`,
                        height: `${radius * 2}px`,
                        borderRadius: '50%',
                        background: person.color || '#3b82f6',
                        border: `${3 * scaleX}px solid white`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: `${20 * scaleX}px`, // 元のコードに合わせて20px
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      },
                      children: person.name.charAt(0),
                    },
                  },
                  // 名前
                  {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: `${x}px`,
                        top: `${y + 45 * scaleY}px`, // 元のブラウザコードに合わせて45px
                        transform: 'translateX(-50%)',
                        background: 'transparent', // 背景を透明に
                        fontSize: `${16 * scaleX}px`,
                        fontWeight: 'bold',
                        color: '#333',
                      },
                      children: person.name,
                    },
                  },
                ];
              }).flat(),
              // Watermark
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    right: `${20 * scaleX}px`,
                    bottom: `${20 * scaleY}px`,
                    color: '#999',
                    fontSize: `${18 * scaleX}px`,
                    fontWeight: 'bold',
                  },
                  children: 'soukanzu.jp',
                },
              },
            ],
          },
        },
        {
          width: 1200,
          height: 630,
          fonts: [
            {
              name: 'Noto Sans JP',
              data: fontData,
              weight: 400,
              style: 'normal',
            },
          ],
        }
      );

      console.log('Converting to PNG...');
      // Convert SVG to PNG using resvg
      const resvg = new Resvg(svg, {
        fitTo: {
          mode: 'width',
          value: 1200,
        },
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      console.log('Success! PNG size:', pngBuffer.length);

      // KVにキャッシュを保存
      if (env.OG_IMAGE_CACHE) {
        const cacheKey = await generateCacheKey(data);
        // 30日間キャッシュ（2592000秒）
        await env.OG_IMAGE_CACHE.put(cacheKey, pngBuffer, {
          expirationTtl: 2592000,
        });
        console.log('Cached image with key:', cacheKey);
      }

      return new Response(pngBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Cache': 'MISS',
        },
      });
    } catch (error) {
      console.error('Error generating image:', error);
      return new Response(JSON.stringify({
        error: 'Error generating image',
        message: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  },
};
