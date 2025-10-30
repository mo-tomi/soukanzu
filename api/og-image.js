import satori from 'satori';
import sharp from 'sharp';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const data = searchParams.get('data');

  if (!data) {
    return new Response('Missing data parameter', { status: 400 });
  }

  try {
    // Decode diagram data
    const diagramData = JSON.parse(decodeURIComponent(data));
    const { people = [], relationships = [] } = diagramData;

    const scaleX = 1200 / 800;
    const scaleY = 630 / 500;

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
              const radius = 40;

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
                    border: '4px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '28px',
                    fontWeight: 'bold',
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
                  fontSize: '16px',
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
      }
    );

    // Convert SVG to PNG using sharp
    const png = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new Response('Error generating image: ' + error.message, { status: 500 });
  }
}