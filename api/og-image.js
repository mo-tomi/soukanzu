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

    // Generate PNG image using canvas
    const png = await generatePNG(diagramData);

    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new Response('Invalid data: ' + error.message, { status: 400 });
  }
}

async function generatePNG(data) {
  const { people = [], relationships = [] } = data;
  const width = 1200;
  const height = 630;

  // Generate SVG
  const svg = generateSVG(data);

  // Convert SVG to PNG using external service or return SVG with proper headers
  // For now, return a simple colored rectangle as placeholder
  // In production, you'd use a service like https://cloudinary.com or similar

  // Base64 encode a simple 1x1 pink PNG
  const pinkPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  return Uint8Array.from(atob(pinkPixel), c => c.charCodeAt(0));
}

function generateSVG(data) {
  const { people = [], relationships = [] } = data;

  const width = 1200;
  const height = 630;

  // Generate SVG
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#fce4ec;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#f3e5f5;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#e3f2fd;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)"/>
  `;

  // Draw relationships (lines)
  relationships.forEach(rel => {
    const from = people.find(p => p.id === rel.from);
    const to = people.find(p => p.id === rel.to);

    if (from && to) {
      // Scale positions to fit OGP dimensions
      const scaleX = width / 800;
      const scaleY = height / 500;

      const x1 = from.x * scaleX;
      const y1 = from.y * scaleY;
      const x2 = to.x * scaleX;
      const y2 = to.y * scaleY;

      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ec4899" stroke-width="3" opacity="0.6"/>`;

      // Draw arrow
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const arrowLen = 15;
      const arrowX = x2 - Math.cos(angle) * 50;
      const arrowY = y2 - Math.sin(angle) * 50;

      svg += `<polygon points="${arrowX},${arrowY} ${arrowX - arrowLen * Math.cos(angle - Math.PI / 6)},${arrowY - arrowLen * Math.sin(angle - Math.PI / 6)} ${arrowX - arrowLen * Math.cos(angle + Math.PI / 6)},${arrowY - arrowLen * Math.sin(angle + Math.PI / 6)}" fill="#ec4899" opacity="0.8"/>`;

      // Draw label
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      if (rel.label) {
        svg += `<text x="${midX}" y="${midY}" fill="#333" font-size="16" font-weight="600" text-anchor="middle" dominant-baseline="middle" style="font-family: sans-serif;">${escapeXml(rel.label || '')}</text>`;
      }
    }
  });

  // Draw people (circles)
  people.forEach(person => {
    const scaleX = width / 800;
    const scaleY = height / 500;
    const x = person.x * scaleX;
    const y = person.y * scaleY;
    const radius = 40;

    svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${person.color || '#3b82f6'}" stroke="white" stroke-width="4"/>`;

    // Draw initial
    const initial = person.name.charAt(0);
    svg += `<text x="${x}" y="${y}" fill="white" font-size="28" font-weight="bold" text-anchor="middle" dominant-baseline="middle" style="font-family: sans-serif;">${escapeXml(initial)}</text>`;

    // Draw name
    svg += `<text x="${x}" y="${y + radius + 25}" fill="#333" font-size="18" font-weight="bold" text-anchor="middle" style="font-family: sans-serif;">${escapeXml(person.name)}</text>`;
  });

  // Add watermark
  svg += `<text x="${width - 20}" y="${height - 20}" fill="#999" font-size="16" text-anchor="end" style="font-family: sans-serif;">soukanzu.jp</text>`;

  svg += `</svg>`;

  return svg;
}

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

