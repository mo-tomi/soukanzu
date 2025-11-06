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

// SVGパスで矢印を作成
function createArrowPath(startX, startY, endX, endY) {
  const angle = Math.atan2(endY - startY, endX - startX);
  const arrowSize = 14;

  const arrowTip1X = endX - arrowSize * Math.cos(angle - Math.PI / 6);
  const arrowTip1Y = endY - arrowSize * Math.sin(angle - Math.PI / 6);
  const arrowTip2X = endX - arrowSize * Math.cos(angle + Math.PI / 6);
  const arrowTip2Y = endY - arrowSize * Math.sin(angle + Math.PI / 6);

  return `M ${startX} ${startY} L ${endX} ${endY} M ${endX} ${endY} L ${arrowTip1X} ${arrowTip1Y} M ${endX} ${endY} L ${arrowTip2X} ${arrowTip2Y}`;
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

      // 関係性のパスを生成
      const relationshipPaths = [];
      const relationshipLabels = [];
      const processedPairs = new Set();

      relationships.forEach(rel => {
        const fromPerson = people.find(p => p.id === rel.from);
        const toPerson = people.find(p => p.id === rel.to);
        if (!fromPerson || !toPerson) return;

        const fromX = fromPerson.x * scaleX;
        const fromY = fromPerson.y * scaleY;
        const toX = toPerson.x * scaleX;
        const toY = toPerson.y * scaleY;

        const angle = Math.atan2(toY - fromY, toX - fromX);
        const avatarRadius = 35 * scaleX;
        const nameHeight = 20 * scaleY;
        const buffer = 10 * scaleY;
        const avoidanceDistance = avatarRadius + nameHeight + buffer;

        const reverseRel = relationships.find(r => r.from === rel.to && r.to === rel.from);
        const isBidirectional = !!reverseRel;
        const pairKey = `${Math.min(rel.from, rel.to)}-${Math.max(rel.from, rel.to)}`;

        if (isBidirectional && !processedPairs.has(pairKey)) {
          processedPairs.add(pairKey);

          const lineOffset = 12 * scaleX;
          const perpAngle = angle + Math.PI / 2;

          // 1本目の線（from -> to）
          const startX1 = fromX + Math.cos(angle) * avoidanceDistance + Math.cos(perpAngle) * lineOffset;
          const startY1 = fromY + Math.sin(angle) * avoidanceDistance + Math.sin(perpAngle) * lineOffset;
          const endX1 = toX - Math.cos(angle) * avoidanceDistance + Math.cos(perpAngle) * lineOffset;
          const endY1 = toY - Math.sin(angle) * avoidanceDistance + Math.sin(perpAngle) * lineOffset;

          relationshipPaths.push(createArrowPath(startX1, startY1, endX1, endY1));

          // ラベル1
          const labelRatio1 = 0.35;
          const labelX1 = startX1 + (endX1 - startX1) * labelRatio1 + Math.cos(perpAngle) * 25 * scaleX;
          const labelY1 = startY1 + (endY1 - startY1) * labelRatio1 + Math.sin(perpAngle) * 25 * scaleY;

          if (rel.label) {
            relationshipLabels.push({
              text: rel.label,
              x: labelX1,
              y: labelY1,
            });
          }

          // 2本目の線（to -> from）
          const startX2 = toX + Math.cos(angle + Math.PI) * avoidanceDistance - Math.cos(perpAngle) * lineOffset;
          const startY2 = toY + Math.sin(angle + Math.PI) * avoidanceDistance - Math.sin(perpAngle) * lineOffset;
          const endX2 = fromX - Math.cos(angle + Math.PI) * avoidanceDistance - Math.cos(perpAngle) * lineOffset;
          const endY2 = fromY - Math.sin(angle + Math.PI) * avoidanceDistance - Math.sin(perpAngle) * lineOffset;

          relationshipPaths.push(createArrowPath(startX2, startY2, endX2, endY2));

          // ラベル2
          if (reverseRel.label) {
            const labelRatio2 = 0.35;
            const labelX2 = startX2 + (endX2 - startX2) * labelRatio2 - Math.cos(perpAngle) * 25 * scaleX;
            const labelY2 = startY2 + (endY2 - startY2) * labelRatio2 - Math.sin(perpAngle) * 25 * scaleY;

            relationshipLabels.push({
              text: reverseRel.label,
              x: labelX2,
              y: labelY2,
            });
          }
        } else if (!isBidirectional) {
          // 単方向の線
          const startX = fromX + Math.cos(angle) * avoidanceDistance;
          const startY = fromY + Math.sin(angle) * avoidanceDistance;
          const endX = toX - Math.cos(angle) * avoidanceDistance;
          const endY = toY - Math.sin(angle) * avoidanceDistance;

          relationshipPaths.push(createArrowPath(startX, startY, endX, endY));

          // ラベル
          if (rel.label) {
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2 - 20 * scaleY;

            relationshipLabels.push({
              text: rel.label,
              x: midX,
              y: midY,
            });
          }
        }
      });

      // SVGパスを結合
      const combinedPath = relationshipPaths.join(' ');

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
              // SVGで線と矢印を描画
              {
                type: 'svg',
                props: {
                  width: '1200',
                  height: '630',
                  viewBox: '0 0 1200 630',
                  style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  },
                  children: [
                    {
                      type: 'path',
                      props: {
                        d: combinedPath,
                        stroke: '#666',
                        'stroke-width': '3',
                        fill: 'none',
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round',
                      },
                    },
                  ],
                },
              },
              // ラベル
              ...relationshipLabels.map(label => ({
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    left: `${label.x}px`,
                    top: `${label.y}px`,
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
                  children: label.text,
                },
              })),
              // 人物
              ...people.map((person) => {
                const x = person.x * scaleX;
                const y = person.y * scaleY;
                const radius = 35 * scaleX;

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
                        border: `${4 * scaleX}px solid white`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: `${20 * scaleX}px`,
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
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
                        top: `${y + 45 * scaleY}px`,
                        transform: 'translateX(-50%)',
                        background: 'transparent',
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
