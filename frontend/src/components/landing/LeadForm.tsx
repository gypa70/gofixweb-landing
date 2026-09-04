import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2, Lock, ArrowRight, FileText } from 'lucide-react';
import {
  REPORT_API_URL,
  TURNSTILE_ACTION,
  TURNSTILE_SITE_KEY,
} from '@/lib/site';

type Variant = 'hero' | 'band';

interface Errors {
  name?: string;
  email?: string;
  shop?: string;
}

interface Lead {
  name: string;
  email: string;
  shop: string;
  mode: string;
  message: string;
}

function normalizeShop(raw: string): string {
  const value = raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return value.toLowerCase();
}

function shopUrlForApi(raw: string): string {
  const shop = normalizeShop(raw);
  return shop ? `https://${shop}` : '';
}

function validate(field: keyof Errors, value: string): string | undefined {
  const v = value.trim();
  if (field === 'name') {
    if (v.length === 0) return 'Zadejte prosím své jméno.';
    if (v.length < 2) return 'Jméno je příliš krátké.';
    return undefined;
  }
  if (field === 'email') {
    if (v.length === 0) return 'Zadejte prosím e-mail, kam pošleme report.';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return 'Tento e-mail nevypadá správně.';
    return undefined;
  }
  const shop = normalizeShop(v);
  if (shop.length === 0) return 'Zadejte adresu svého e-shopu.';
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/.test(shop)) return 'Zadejte platnou adresu, např. mujeshop.cz';
  return undefined;
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector('script[data-gfw-turnstile]');
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      if (window.turnstile) resolve();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.gfwTurnstile = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile_script'));
    document.head.appendChild(script);
  });
}

export default function LeadForm({ variant = 'hero' }: { variant?: Variant }) {
  const [values, setValues] = useState({ name: '', email: '', shop: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<Lead | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const widgetHost = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      try {
        await loadTurnstileScript();
      } catch {
        return;
      }
      if (cancelled || !widgetHost.current || !window.turnstile || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(widgetHost.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action: TURNSTILE_ACTION,
        theme: 'dark',
      });
    };

    void mount();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetTurnstile = () => {
    if (window.turnstile && widgetId.current) {
      window.turnstile.reset(widgetId.current);
    }
  };

  const onBlur = (field: keyof Errors) => {
    setErrors((prev) => ({ ...prev, [field]: validate(field, values[field]) }));
  };

  const onChange = (field: keyof Errors, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Errors = {
      name: validate('name', values.name),
      email: validate('email', values.email),
      shop: validate('shop', values.shop),
    };
    setErrors(next);
    setSubmitError(null);
    if (next.name || next.email || next.shop) return;

    const turnstileToken =
      window.turnstile && widgetId.current ? window.turnstile.getResponse(widgetId.current) || '' : '';
    if (!turnstileToken) {
      setSubmitError('Ověření proti robotům ještě není hotové. Počkejte vteřinu a zkuste to znovu.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(REPORT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          shop_url: shopUrlForApi(values.shop),
          turnstile_token: turnstileToken,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        mode?: string;
      };

      if (response.ok && data.ok) {
        const mode = data.mode || 'inquiry';
        const defaultMsg =
          mode === 'scan' ? 'Report bude odeslán do 10 minut.' : 'Děkujeme, brzy se vám ozveme.';
        setDone({
          name: values.name.trim(),
          email: values.email.trim(),
          shop: normalizeShop(values.shop),
          mode,
          message: data.message || defaultMsg,
        });
        return;
      }

      if (response.status === 429 || data.error === 'rate_limited') {
        setSubmitError(data.message || 'Pro tento e-mail už dnes byl formulář odeslán.');
        return;
      }
      if (String(data.error || '').startsWith('turnstile')) {
        setSubmitError(data.message || 'Ověření proti robotům selhalo. Zkuste to znovu.');
        return;
      }
      setSubmitError('Odeslání se nepodařilo. Zkuste to znovu, nebo napište na info@gofixweb.com.');
    } catch {
      setSubmitError('Odeslání se nepodařilo. Zkuste to znovu, nebo napište na info@gofixweb.com.');
    } finally {
      resetTurnstile();
      setLoading(false);
    }
  };

  if (done) {
    const firstName = done.name.split(' ')[0];
    const isScan = done.mode === 'scan';
    return (
      <div
        className={
          variant === 'hero'
            ? 'rounded-lg border border-primary/35 bg-card p-6 sm:p-7'
            : 'rounded-lg border border-primary/35 bg-background/40 p-6 sm:p-7'
        }
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15">
          <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-xl">Máme to, {firstName}.</h3>
        <p className="mt-2 text-sm text-muted-foreground">{done.message}</p>
        {isScan ? (
          <ol className="mt-5 space-y-3 text-sm">
            {[
              'Do 10 minut proběhne technický sken přes Google PageSpeed API.',
              'Do hodiny dostanete PDF s nalezenými chybami a vyčíslenou měsíční ztrátou.',
              'Bez závazku se rozhodnete, jestli chyby opravíme za vás.',
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-primary">
                  {index + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            Poptávka na e-shop <span className="text-foreground">{done.shop}</span> přišla na{' '}
            <span className="text-foreground">{done.email}</span>. Ozveme se vám.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setValues({ name: '', email: '', shop: '' });
            setSubmitError(null);
          }}
          className="mt-6 text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-4 transition-colors duration-200 hover:md:text-primary/80"
        >
          Poslat další e-shop k analýze
        </button>
      </div>
    );
  }

  const fieldClass = (field: keyof Errors) =>
    `h-11 bg-secondary/70 border-border text-foreground placeholder:text-muted-foreground/70 ${
      errors[field] ? 'border-destructive ring-1 ring-destructive' : ''
    }`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={
        variant === 'hero'
          ? 'rounded-lg border border-border bg-card p-6 sm:p-7'
          : 'rounded-lg border border-border/70 bg-background/40 p-6 sm:p-7'
      }
    >
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Bezplatná analýza</span>
      </div>
      <h3 className="mt-3 text-xl">Zjistěte, kolik vás chyby stojí</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Report do 10 minut. Bez platební karty, bez přístupů do administrace.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor={`name-${variant}`} className="text-xs font-semibold text-muted-foreground">
            Jméno
          </Label>
          <Input
            id={`name-${variant}`}
            value={values.name}
            onChange={(e) => onChange('name', e.target.value)}
            onBlur={() => onBlur('name')}
            placeholder="Jan Novák"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            className={`mt-1.5 ${fieldClass('name')}`}
          />
          {errors.name && <p className="mt-1.5 text-xs text-destructive">{errors.name}</p>}
        </div>

        <div>
          <Label htmlFor={`email-${variant}`} className="text-xs font-semibold text-muted-foreground">
            E-mail
          </Label>
          <Input
            id={`email-${variant}`}
            type="email"
            value={values.email}
            onChange={(e) => onChange('email', e.target.value)}
            onBlur={() => onBlur('email')}
            placeholder="jan@mujeshop.cz"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            className={`mt-1.5 ${fieldClass('email')}`}
          />
          {errors.email && <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>}
        </div>

        <div>
          <Label htmlFor={`shop-${variant}`} className="text-xs font-semibold text-muted-foreground">
            Adresa e-shopu
          </Label>
          <Input
            id={`shop-${variant}`}
            value={values.shop}
            onChange={(e) => onChange('shop', e.target.value)}
            onBlur={() => onBlur('shop')}
            placeholder="mujeshop.cz"
            autoComplete="url"
            aria-invalid={Boolean(errors.shop)}
            className={`mt-1.5 ${fieldClass('shop')}`}
          />
          {errors.shop && <p className="mt-1.5 text-xs text-destructive">{errors.shop}</p>}
        </div>
      </div>

      <div
        ref={widgetHost}
        id={`turnstile-${variant}`}
        className="mt-5"
        aria-label="Ověření proti robotům"
      />

      {submitError && <p className="mt-3 text-xs text-destructive">{submitError}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="mt-6 h-12 w-full bg-primary text-base font-bold text-primary-foreground transition-colors duration-200 hover:md:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Odesílám…
          </>
        ) : (
          <>
            Chci bezplatnou analýzu
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </>
        )}
      </Button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Odesláním souhlasíte se zpracováním údajů dle{' '}
        <Link
          to="/ochrana-osobnich-udaju"
          className="font-semibold text-foreground underline decoration-primary/40 underline-offset-4"
        >
          ochrany osobních údajů
        </Link>
        .
      </p>
    </form>
  );
}
