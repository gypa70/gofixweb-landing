import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * React Router keeps the previous scroll position on client-side navigations.
 * Without a reset, a "Blog" click from the landing footer opens the article
 * list already scrolled to the bottom.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const scrollToHash = () => document.getElementById(id)?.scrollIntoView();
      scrollToHash();
      const frame = window.requestAnimationFrame(scrollToHash);
      return () => window.cancelAnimationFrame(frame);
    }

    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);

  return null;
}
