/** Public /blog listing and /blog/{slug} pages. Data from scripts/build_blog.py. */

import { BLOG_DATA } from "./blog-posts.generated.js";

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function notFoundPage() {
  const sample = BLOG_DATA.indexHtml || "";
  if (sample.includes("<main>")) {
    return sample.replace(
      /<main>[\s\S]*<\/main>/,
      `<main>
    <div class="container">
      <article class="article">
        <a class="article-back" href="/blog/">← Všechny články</a>
        <h1>Článek se nenašel</h1>
        <p>Tento odkaz v blogu GoFixWeb neexistuje. <a href="/blog/">Zpět na seznam článků</a>.</p>
      </article>
    </div>
  </main>`,
    );
  }
  return `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><title>Nenalezeno</title></head><body><p>Nenalezeno. <a href="/blog/">Blog</a></p></body></html>`;
}

export function handleBlogRequest(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const url = new URL(request.url);
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  if (path === "/blog") {
    return htmlResponse(BLOG_DATA.indexHtml);
  }
  const match = path.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match) return null;
  const post = (BLOG_DATA.posts || []).find((item) => item.slug === match[1]);
  if (!post) return htmlResponse(notFoundPage(), 404);
  return htmlResponse(post.html);
}
