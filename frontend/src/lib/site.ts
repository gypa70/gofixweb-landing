/** Production Worker — stejný origin jako stávající LP checkout a /submit. */
export const WORKER_ORIGIN =
  'https://gofixweb-report-trigger.gofixweb-report-trigger.workers.dev';

export const REPORT_API_URL = `${WORKER_ORIGIN}/submit`;
export const CHECKOUT_URL = `${WORKER_ORIGIN}/checkout`;
export const TURNSTILE_SITE_KEY = '0x4AAAAAAERBDgPD_ejGBr5Q';
export const TURNSTILE_ACTION = 'free-report';
export const PUBLIC_STATS_URL = 'https://gofixweb.com/data/public_stats.json';

export function checkoutHref(product: string): string {
  return `${CHECKOUT_URL}?product=${encodeURIComponent(product)}`;
}
