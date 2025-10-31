export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const data = searchParams.get('data');

  if (!data) {
    return new Response('Missing data parameter', { status: 400 });
  }

  // Redirect to Cloudflare Worker for PNG generation
  const cloudflareUrl = `https://soukanzu-og-image.tomimoe1226.workers.dev?data=${data}`;

  try {
    const response = await fetch(cloudflareUrl);

    if (!response.ok) {
      throw new Error(`Cloudflare Worker returned ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new Response('Error generating image: ' + error.message, { status: 500 });
  }
}
