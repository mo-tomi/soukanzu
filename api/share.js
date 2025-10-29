export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const data = searchParams.get('data');

  if (!data) {
    // Redirect to home if no data
    return Response.redirect('https://soukanzu.jp/', 302);
  }

  try {
    // Decode to validate
    JSON.parse(decodeURIComponent(data));

    const ogImageUrl = `https://soukanzu.jp/api/og-image?data=${data}`;

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>相関図を作成しました！ - 相関図ジェネレーター</title>
  <meta name="description" content="相関図ジェネレーターで作成した相関図を見る">

  <!-- OGP -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="相関図を作成しました！">
  <meta property="og:description" content="相関図ジェネレーターで作成した相関図です">
  <meta property="og:url" content="${request.url}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="相関図を作成しました！">
  <meta name="twitter:description" content="相関図ジェネレーターで作成した相関図です">
  <meta name="twitter:image" content="${ogImageUrl}">

  <script>
    // Redirect to home with data
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');
    if (data) {
      // Store in localStorage and redirect
      try {
        const diagramData = JSON.parse(decodeURIComponent(data));
        localStorage.setItem('relationshipDiagram', JSON.stringify(diagramData));
      } catch (e) {
        console.error('Failed to parse data', e);
      }
    }
    window.location.href = '/';
  </script>
</head>
<body>
  <div style="font-family: sans-serif; text-align: center; padding: 50px;">
    <h1>リダイレクト中...</h1>
    <p>相関図ジェネレーターに移動します。</p>
    <p><a href="/">こちらをクリック</a>してください。</p>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    return Response.redirect('https://soukanzu.jp/', 302);
  }
}
