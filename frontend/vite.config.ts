import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import fs from 'node:fs';
import path from 'path';
import { vitePrerenderPlugin } from 'vite-prerender-plugin';
import Sitemap from 'vite-plugin-sitemap';
import { getBlogRoutes } from './prerender/blog-routes.js';
import { getSitemapLastmod } from './prerender/blog-sitemap.js';

function ensureBuildOutDir() {
  let outDir = path.resolve(__dirname, 'dist');

  return {
    name: 'ensure-build-out-dir',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      fs.mkdirSync(outDir, { recursive: true });
    },
  };
}

export default defineConfig(({ command }) => {
  const blogPrerenderRoutes = command === 'build' ? getBlogRoutes() : [];

  return {
    plugins: [
      react(),
      ensureBuildOutDir(),
      Sitemap({
        hostname: 'https://gofixweb.com',
        lastmod: getSitemapLastmod(),
        readable: true,
        generateRobotsTxt: true,
      }),
      ...(blogPrerenderRoutes.length > 0
        ? vitePrerenderPlugin({
            renderTarget: '#root',
            prerenderScript: path.resolve(__dirname, 'prerender/blog.js'),
            additionalPrerenderRoutes: blogPrerenderRoutes,
          })
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: parseInt(process.env.VITE_PORT || '3000'),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'ui-vendor': [
              '@radix-ui/react-accordion',
              '@radix-ui/react-dialog',
              '@radix-ui/react-label',
              '@radix-ui/react-slot',
              '@radix-ui/react-tooltip',
            ],
            'utils-vendor': ['clsx', 'tailwind-merge', 'class-variance-authority', 'lucide-react'],
            'query-vendor': ['@tanstack/react-query'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});
