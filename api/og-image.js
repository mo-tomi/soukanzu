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
    const diagramData = JSON.parse(decodeURIComponent(data));
    const { people = [], relationships = [] } = diagramData;

    // HTML+CSSで画像生成
    const html = generateDiagramHTML(people, relationships);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new Response('Error: ' + error.message, { status: 500 });
  }
}

function generateDiagramHTML(people, relationships) {
  const scaleX = 1200 / 800;
  const scaleY = 630 / 500;

  const peopleHTML = people.map(person => {
    const x = person.x * scaleX;
    const y = person.y * scaleY;
    return `
      <div style="position: absolute; left: ${x - 50}px; top: ${y - 50}px; text-align: center;">
        <div style="width: 100px; height: 100px; border-radius: 50%; background: ${person.color};
                    border: 5px solid white; display: flex; align-items: center; justify-content: center;
                    color: white; font-size: 36px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          ${person.name[0]}
        </div>
        <div style="margin-top: 10px; background: white; padding: 8px 16px; border-radius: 8px;
                    font-weight: bold; font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          ${person.name}
        </div>
      </div>
    `;
  }).join('');

  const relHTML = relationships.map(rel => {
    const from = people.find(p => p.id === rel.from);
    const to = people.find(p => p.id === rel.to);
    if (!from || !to) return '';

    const fromX = from.x * scaleX;
    const fromY = from.y * scaleY;
    const toX = to.x * scaleX;
    const toY = to.y * scaleY;

    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;

    return `
      <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
        <defs>
          <marker id="arrow-${rel.id}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#ec4899" />
          </marker>
        </defs>
        <line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}"
              stroke="#ec4899" stroke-width="3" opacity="0.7" marker-end="url(#arrow-${rel.id})" />
      </svg>
      <div style="position: absolute; left: ${midX}px; top: ${midY}px; transform: translate(-50%, -50%);
                  background: rgba(255,255,255,0.95); padding: 6px 12px; border-radius: 8px;
                  border: 2px solid #e0e0e0; font-weight: bold; font-size: 16px;">
        ${rel.label}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            width: 1200px;
            height: 630px;
            background: linear-gradient(135deg, #fce4ec 0%, #f3e5f5 50%, #e3f2fd 100%);
            font-family: sans-serif;
            position: relative;
          }
        </style>
      </head>
      <body>
        ${relHTML}
        ${peopleHTML}
        <div style="position: absolute; right: 20px; bottom: 20px; color: #999; font-size: 18px; font-weight: bold;">
          soukanzu.jp
        </div>
      </body>
    </html>
  `;
}
