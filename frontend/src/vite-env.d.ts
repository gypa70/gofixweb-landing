/// <reference types="vite/client" />

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
}

interface Window {
  turnstile?: {
    render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
    reset: (widgetId: string) => void;
    getResponse: (widgetId: string) => string;
  };
}
