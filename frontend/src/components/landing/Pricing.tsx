import { Button } from '@/components/ui/button';
import { Check, ShieldCheck, Zap, FileText } from 'lucide-react';
import { checkoutHref } from '@/lib/site';

const oneTimeVariants = [
  {
    name: 'Auto',
    tag: 'Pouze WooCommerce',
    icon: Zap,
    body: 'Opravu nasadíme za vás přes WordPress Application Password. Nemusíte nikam posílat hlavní administrátorské údaje ani nic instalovat.',
    features: [
      'Automatická oprava SEO nastavení',
      'Komprese obrázků na celém e-shopu',
      'Oprava konfliktních a chybně nastavených pluginů',
      'Kontrolní měření po nasazení',
    ],
  },
  {
    name: 'Manuál',
    tag: 'Jakákoli platforma',
    icon: FileText,
    body: 'Shoptet, Shopify, Magento, PrestaShop i vlastní řešení. Dostanete PDF návod krok za krokem, podle kterého opravu provedete vy nebo váš vývojář.',
    features: [
      'PDF návod krok za krokem',
      'Chyby seřazené podle dopadu na obrat',
      'Vyčíslená měsíční ztráta u každé chyby',
      'Funguje na jakékoli platformě',
    ],
  },
];

const tiers = [
  {
    name: 'Basic',
    product: 'basic',
    price: '1 490',
    fit: 'E-shopy do 300 000 Kč obratu měsíčně',
    outcome: 'Víte, co je rozbité, a opravujete si sami.',
    features: ['Měsíční sken e-shopu', '1 oprava měsíčně', 'PDF report s vyčíslenou ztrátou', 'E-mail podpora'],
    highlighted: false,
  },
  {
    name: 'Pro',
    product: 'pro',
    price: '3 990',
    fit: 'E-shopy s obratem 300 tis. – 1,5 mil. Kč',
    outcome: 'Chyby opravujeme my, vy jen čtete výsledky.',
    features: [
      'Týdenní sken e-shopu',
      '4 opravy měsíčně',
      'Nasazení oprav naším týmem',
      'Kontrolní měření před / po',
      'Prioritní e-mail podpora',
    ],
    highlighted: true,
  },
  {
    name: 'Premium',
    product: 'premium',
    price: '6 990',
    fit: 'E-shopy nad 1,5 mil. Kč a více domén',
    outcome: 'Průběžná optimalizace bez vlastního vývojáře.',
    features: [
      'Denní sken e-shopu',
      'Neomezené opravy',
      'Průběžná optimalizace rychlosti',
      'Měsíční konzultace 60 minut',
      'Telefonická podpora',
    ],
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="ceny" className="section-line py-20 sm:py-28">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Ceník</span>
          <h2 className="mt-4">Jednorázová oprava za jednu cenu</h2>
          <p className="mt-5 text-muted-foreground">
            Analýza je vždy bezplatná. Platíte teprve tehdy, když se rozhodnete chyby skutečně opravit — a to
            jednorázově, bez předplatného a bez závazku pokračovat.
          </p>
        </div>

        <div className="mt-12 rounded-lg border-2 border-primary bg-card p-7 sm:p-9">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-4">
              <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                Nejčastější volba
              </span>
              <h3 className="mt-5 text-[1.6rem]">Audit + oprava</h3>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="tnum display text-[3rem] font-extrabold leading-none">1 990 Kč</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                jednorázově — stejná cena pro obě varianty níže
              </p>
              <p className="mt-6 text-sm text-foreground/90">
                Najdeme chyby, vyčíslíme jejich měsíční dopad na obrat a opravíme je. Žádné měsíční platby.
              </p>
              <Button
                asChild
                className="mt-7 h-12 w-full bg-primary text-base font-bold text-primary-foreground transition-colors duration-200 hover:md:bg-primary/90"
              >
                <a href="#analyza">Začít bezplatnou analýzou</a>
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
              {oneTimeVariants.map((variant) => (
                <div key={variant.name} className="rounded-lg border border-border bg-background p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/12 text-primary">
                      <variant.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h4 className="display text-base font-bold">{variant.name}</h4>
                      <p className="text-xs font-semibold text-muted-foreground">{variant.tag}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{variant.body}</p>
                  <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                    {variant.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-20 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Volitelně — průběžná ochrana
          </span>
          <h3 className="mt-4 text-[1.6rem]">Aby se chyby nevracely</h3>
          <p className="mt-4 text-muted-foreground">
            Nové chyby vznikají při každé aktualizaci šablony, pluginu nebo kampaně. Pokud je chcete odhalit dřív než
            zákazníci, můžete po jednorázové opravě přejít na pravidelný sken. Předplatné zrušíte kdykoli, bez
            výpovědní lhůty.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={
                tier.highlighted
                  ? 'flex h-full flex-col rounded-lg border border-primary/50 bg-card p-6 sm:p-7'
                  : 'flex h-full flex-col rounded-lg border border-border bg-card/50 p-6 sm:p-7'
              }
            >
              <div className="flex items-baseline gap-2">
                <h4 className={`display text-lg font-bold ${tier.highlighted ? 'text-primary' : ''}`}>{tier.name}</h4>
                {tier.highlighted && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Nejčastější u předplatného
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{tier.fit}</p>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="tnum display text-[2rem] font-extrabold leading-none">{tier.price} Kč</span>
                <span className="text-sm text-muted-foreground">/ měsíc</span>
              </p>

              <p className="mt-4 text-sm font-semibold text-foreground/90">{tier.outcome}</p>

              <ul className="mt-5 flex-1 space-y-3 border-t border-border pt-5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${tier.highlighted ? 'text-primary' : 'text-muted-foreground'}`}
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="mt-7 h-11 w-full !bg-transparent text-sm font-semibold text-foreground ring-1 ring-inset ring-border transition-colors duration-200 hover:md:!bg-transparent hover:md:ring-primary/60"
              >
                <a href={checkoutHref(tier.product)}>Objednat {tier.name}</a>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-start gap-3 rounded-lg border border-border bg-card/40 p-5 sm:items-center">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:mt-0" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Bez rizika:</span> pokud u vašeho e-shopu nenajdeme ani
            jednu chybu s doloženým finančním dopadem, nic neplatíte. Ceny v ceníku jsou konečné — nic dalšího se k
            nim nepřipočítává. Nejsme plátci DPH.
          </p>
        </div>
      </div>
    </section>
  );
}