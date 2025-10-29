import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
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

    // Generate image using @vercel/og
    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            position: 'relative',
            background: 'linear-gradient(135deg, #fce4ec 0%, #f3e5f5 50%, #e3f2fd 100%)',
          }}
        >
          {/* Draw people as circles */}
          {people.map((person, idx) => {
            const x = person.x * scaleX;
            const y = person.y * scaleY;
            const radius = 40;

            return (
              <div
                key={idx}
                style={{
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
                }}
              >
                {person.name.charAt(0)}
              </div>
            );
          })}

          {/* Watermark */}
          <div
            style={{
              position: 'absolute',
              right: '20px',
              bottom: '20px',
              color: '#999',
              fontSize: '16px',
            }}
          >
            soukanzu.jp
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    return new Response('Invalid data: ' + error.message, { status: 400 });
  }
}