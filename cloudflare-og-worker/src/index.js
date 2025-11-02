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
              // Draw people circles
              ...people.map((person) => {
                const x = person.x * scaleX;
                const y = person.y * scaleY;
                const radius = 50;

                return {
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
                };
              }),
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
