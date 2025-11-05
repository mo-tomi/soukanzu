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

export default {
  async fetch(request) {
    await ensureWasmInitialized();
    const url = new URL(request.url);
    const data = url.searchParams.get('data');

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
      return new Response('Missing data parameter', { status: 400 });
    }

    try {
      // Decode diagram data
      const diagramData = JSON.parse(decodeURIComponent(data));
      const { people = [], relationships = [] } = diagramData;

      const scaleX = 1200 / 800;
      const scaleY = 630 / 500;

      // Fetch font for Satori
      const fontResponse = await fetch('https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEi75vY0rw-oME.ttf');
      const fontData = await fontResponse.arrayBuffer();

      // Generate SVG using Satori
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
              // 関係性の線と矢印を先に描画（背景レイヤー）
              ...relationships.map(rel => {
                const fromPerson = people.find(p => p.id === rel.from);
                const toPerson = people.find(p => p.id === rel.to);
                if (!fromPerson || !toPerson) return null;

                const fromX = fromPerson.x * scaleX;
                const fromY = fromPerson.y * scaleY;
                const toX = toPerson.x * scaleX;
                const toY = toPerson.y * scaleY;

                // 角度と距離を計算
                const angle = Math.atan2(toY - fromY, toX - fromX);
                const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
                const radius = 60;

                // 始点と終点（円の外側から開始）
                const startX = fromX + Math.cos(angle) * radius;
                const startY = fromY + Math.sin(angle) * radius;
                const endX = toX - Math.cos(angle) * radius;
                const endY = toY - Math.sin(angle) * radius;

                // 線の長さ
                const lineLength = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

                // ラベルの位置（線の中央より少し上）
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2 - 20;

                return [
                  // 矢印の線
                  {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: `${startX}px`,
                        top: `${startY}px`,
                        width: `${lineLength}px`,
                        height: '3px',
                        background: '#ec4899',
                        opacity: 0.7,
                        transform: `rotate(${angle}rad)`,
                        transformOrigin: '0 50%',
                      },
                    },
                  },
                  // 矢印の先端
                  {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: `${endX}px`,
                        top: `${endY}px`,
                        width: 0,
                        height: 0,
                        borderLeft: '12px solid #ec4899',
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent',
                        opacity: 0.8,
                        transform: `rotate(${angle}rad) translateX(-12px)`,
                        transformOrigin: '0 50%',
                      },
                    },
                  },
                  // 関係性のラベル
                  rel.label ? {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: `${midX}px`,
                        top: `${midY}px`,
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(255, 255, 255, 0.95)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#333',
                        border: '1px solid #e0e0e0',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      },
                      children: rel.label,
                    },
                  } : null,
                ];
              }).filter(Boolean).flat().filter(Boolean),
              // 人物の円と名前を描画（前面レイヤー）
              ...people.map((person) => {
                const x = person.x * scaleX;
                const y = person.y * scaleY;
                const radius = 50;

                return [
                  // 人物の円
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
                        border: '5px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '36px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      },
                      children: person.name.charAt(0),
                    },
                  },
                  // 名前のラベル
                  {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        left: `${x}px`,
                        top: `${y + radius + 12}px`,
                        transform: 'translateX(-50%)',
                        background: 'rgba(255, 255, 255, 0.95)',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#333',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
                    right: '20px',
                    bottom: '20px',
                    color: '#999',
                    fontSize: '18px',
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

      // Convert SVG to PNG using resvg
      const resvg = new Resvg(svg, {
        fitTo: {
          mode: 'width',
          value: 1200,
        },
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      return new Response(pngBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error) {
      return new Response('Error generating image: ' + error.message, {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
