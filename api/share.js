export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const compressedData = searchParams.get('d'); // 圧縮データ（新形式）
  const uncompressedData = searchParams.get('data'); // 非圧縮データ（旧形式・互換性のため）
  const timestamp = searchParams.get('id') || Date.now(); // シェアURLのタイムスタンプを取得

  // どちらかのパラメータが必要
  if (!compressedData && !uncompressedData) {
    return Response.redirect('https://soukanzu.jp/', 302);
  }

  try {
    let diagramData;

    // 圧縮データがある場合は、後でCloudflare Worker側でデコード
    // ここでは単純にパススルー用のダミーデータを作成
    if (compressedData) {
      // 圧縮データの場合、Cloudflare Workerに渡すためそのまま使用
      // タイトル生成のため、最低限のパース試行（失敗しても問題なし）
      try {
        // LZ-String デコード処理をCloudflare Worker側に任せる
        diagramData = { people: [], relationships: [] }; // デフォルト値
      } catch (e) {
        diagramData = { people: [], relationships: [] };
      }
    } else {
      // 非圧縮データの場合（旧形式・互換性）
      diagramData = JSON.parse(decodeURIComponent(uncompressedData));
    }

    const { people = [], relationships = [] } = diagramData;

    // 相関図データに基づいて動的にタイトルと説明文を生成
    let title = '相関図を作成しました！';
    let description = '相関図ジェネレーターで作成した相関図です';

    if (people.length > 0) {
      const names = people.slice(0, 3).map(p => p.name).join('、');
      const suffix = people.length > 3 ? `ほか${people.length}人` : '';
      title = `${names}${suffix}の相関図`;
      description = `${people.length}人の人間関係を可視化した相関図です`;
    }

    // Cloudflare Workerに渡すパラメータを決定
    const dataParam = compressedData ? `d=${compressedData}` : `data=${encodeURIComponent(uncompressedData)}`;
    const ogImageUrl = `https://soukanzu-og-image.soukanzu.workers.dev?${dataParam}&v=${timestamp}`;

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 相関図ジェネレーター</title>
  <meta name="description" content="${description}">

  <!-- OGP -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${request.url}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta property="og:site_name" content="相関図ジェネレーター">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImageUrl}">
  <meta name="twitter:site" content="@TOMI_AI_">

  <script>
    // クローラー用に待機してからリダイレクト（3秒に延長）
    setTimeout(function() {
      const urlParams = new URLSearchParams(window.location.search);
      const data = urlParams.get('data');
      if (data) {
        try {
          const diagramData = JSON.parse(decodeURIComponent(data));
          localStorage.setItem('relationshipDiagram', JSON.stringify(diagramData));
        } catch (e) {
          console.error('Failed to parse data', e);
        }
      }
      window.location.href = '/';
    }, 3000); // 500msから3000msに変更
  </script>

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #fce4ec 0%, #f3e5f5 50%, #e3f2fd 100%);
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      max-width: 500px;
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
      font-size: 1.5em;
    }
    p {
      color: #666;
      margin-bottom: 15px;
    }
    a {
      color: #2196F3;
      text-decoration: none;
      font-weight: 600;
    }
    a:hover {
      text-decoration: underline;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #2196F3;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    /* OG画像のプリロード */
    .preload-image {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <!-- OG画像をプリロード -->
  <img src="${ogImageUrl}" class="preload-image" alt="">

  <div class="container">
    <div class="spinner"></div>
    <h1>相関図を読み込んでいます...</h1>
    <p>相関図ジェネレーターに移動します。</p>
    <p><a href="/">自動的に移動しない場合はこちらをクリック</a></p>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // クローラーのキャッシュを延長
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  } catch (error) {
    console.error('Error generating share page:', error);
    return Response.redirect('https://soukanzu.jp/', 302);
  }
}
