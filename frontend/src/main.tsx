import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (
  document.querySelector('meta[name="prerender-static-page"]')?.getAttribute('content') === 'blog'
) {
  // Prerendered blog stays static HTML for crawlers.
} else {
  createRoot(document.getElementById('root')!).render(<App />);
}
