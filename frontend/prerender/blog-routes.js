import path from 'node:path';
import { seoContentDir, normalizeRouteFromMarkdown, collectMarkdownFiles } from './utils.js';

export function getBlogRoutes() {
  const routes = new Set(['/blog/', '/vop', '/ochrana-osobnich-udaju']);

  for (const filePath of collectMarkdownFiles(seoContentDir)) {
    const relativePath = path.relative(seoContentDir, filePath);
    routes.add(normalizeRouteFromMarkdown(relativePath));
  }

  return Array.from(routes).sort();
}
