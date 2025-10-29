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

    const width = 1200;
    const height = 630;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #fce4ec 0%, #f3e5f5 50%, #e3f2fd 100%)',
            position: 'relative',
          }}
        >
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Draw relationships */}
            {relationships.map((rel, idx) => {
              const from = people.find(p => p.id === rel.from);
              const to = people.find(p => p.id === rel.to);

              if (!from || !to) return null;

              const scaleX = width / 800;
              const scaleY = height / 500;
              const x1 = from.x * scaleX;
              const y1 = from.y * scaleY;
              const x2 = to.x * scaleX;
              const y2 = to.y * scaleY;

              const angle = Math.atan2(y2 - y1, x2 - x1);
              const arrowLen = 15;
              const arrowX = x2 - Math.cos(angle) * 50;
              const arrowY = y2 - Math.sin(angle) * 50;

              return (
                <g key={`rel-${idx}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#ec4899"
                    strokeWidth="3"
                    opacity="0.6"
                  />
                  <polygon
                    points={`${arrowX},${arrowY} ${arrowX - arrowLen * Math.cos(angle - Math.PI / 6)},${arrowY - arrowLen * Math.sin(angle - Math.PI / 6)} ${arrowX - arrowLen * Math.cos(angle + Math.PI / 6)},${arrowY - arrowLen * Math.sin(angle + Math.PI / 6)}`}
                    fill="#ec4899"
                    opacity="0.8"
                  />
                  {rel.label && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2}
                      fill="#333"
                      fontSize="16"
                      fontWeight="600"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontFamily="sans-serif"
                    >
                      {rel.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Draw people */}
            {people.map((person, idx) => {
              const scaleX = width / 800;
              const scaleY = height / 500;
              const x = person.x * scaleX;
              const y = person.y * scaleY;
              const radius = 40;

              return (
                <g key={`person-${idx}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={person.color || '#3b82f6'}
                    stroke="white"
                    strokeWidth="4"
                  />
                  <text
                    x={x}
                    y={y + radius + 25}
                    fill="#333"
                    fontSize="18"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                  >
                    {person.name}
                  </text>
                </g>
              );
            })}

            {/* Watermark */}
            <text
              x={width - 20}
              y={height - 20}
              fill="#999"
              fontSize="16"
              textAnchor="end"
              fontFamily="sans-serif"
            >
              soukanzu.jp
            </text>
          </svg>
        </div>
      ),
      {
        width,
        height,
      }
    );
  } catch (error) {
    return new Response('Invalid data', { status: 400 });
  }
}

