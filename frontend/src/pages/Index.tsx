import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import LeadForm from '@/components/landing/LeadForm';
import LossCalculator from '@/components/landing/LossCalculator';
import HowItWorks from '@/components/landing/HowItWorks';
import SocialProof from '@/components/landing/SocialProof';
import Pricing from '@/components/landing/Pricing';
import FaqSection from '@/components/landing/FaqSection';
import { formatScannedShops, useScannedShops } from '@/hooks/use-scanned-shops';
import { Menu, X, Zap, Clock, CreditCard, FileDown, ArrowRight } from 'lucide-react';

const HERO_BACKDROP = '/images/hero-backdrop-abstract-dark-teal.png';

type NavLink = {
  label: string;
  /** On-page anchor target (landing sections). */
  href?: string;
  /** Router target for real pages such as the blog. */
  to?: string;
};

const navLinks: NavLink[] = [
  { label: 'Jak to funguje', href: '#jak-to-funguje' },
  { label: 'Kalkulačka', href: '#kalkulacka' },
  { label: 'Výsledky', href: '#vysledky' },
  { label: 'Ceník', href: '#ceny' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Blog', to: '/blog/' },
];

/** Renders an anchor for on-page sections and a router link for real routes. */
function NavItem({
  link,
  className,
  onClick,
}: {
  link: NavLink;
  className: string;
  onClick?: () => void;
}) {
  if (link.to) {
    return (
      <Link to={link.to} className={className} onClick={onClick}>
        {link.label}
      </Link>
    );
  }

  return (
    <a href={link.href} className={className} onClick={onClick}>
      {link.label}
    </a>
  );
}

const reducers = [
  { icon: Clock, text: 'Okamžitý sken' },
  { icon: CreditCard, text: 'Bez platební karty' },
  { icon: Zap, text: 'Bez přístupů do administrace' },
  { icon: FileDown, text: 'Výsledek v PDF' },
];

const platforms = ['Shoptet', 'Shopify', 'WooCommerce', 'Magento', 'PrestaShop'];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'border-b border-border bg-background/95 backdrop-blur' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-screen-xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="display shrink-0 text-lg font-extrabold tracking-tight">
          GoFix<span className="text-primary">Web</span>
        </a>

        <nav className="ml-auto hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <NavItem
              key={link.label}
              link={link}
              className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:md:text-foreground"
            />
          ))}
        </nav>

        <Button
          asChild
          className="ml-auto h-10 bg-primary px-5 font-bold text-primary-foreground transition-colors duration-200 hover:md:bg-primary/90 lg:ml-0"
        >
          <a href="#analyza">Bezplatná analýza</a>
        </Button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Zavřít menu' : 'Otevřít menu'}
          aria-expanded={open}
          className="text-muted-foreground transition-colors duration-200 hover:md:text-foreground lg:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="mx-auto flex max-w-screen-xl flex-col px-4 py-2 sm:px-6">
            {navLinks.map((link) => (
              <NavItem
                key={link.label}
                link={link}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-3 text-sm font-medium text-muted-foreground last:border-0"
              />
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const scannedShops = useScannedShops();

  return (
    <section id="top" className="relative overflow-hidden">
      <img
        src={HERO_BACKDROP}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.30]"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, hsl(var(--background)) 8%, hsl(var(--background) / 0.72) 52%, hsl(var(--background) / 0.94) 100%)',
        }}
      />

      <div className="relative mx-auto max-w-screen-xl px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="rise lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.08] px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              <span className="text-xs font-semibold text-primary">
                Data z Google PageSpeed API — ne z našeho odhadu
              </span>
            </div>

            <h1 className="mt-6">
              Váš e-shop ztrácí peníze na chybách,
              <br className="hidden sm:block" /> které nikdo <span className="text-primary">nezměřil</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Najdeme technické chyby ve vašem e-shopu, přepočítáme je na{' '}
              <span className="font-semibold text-accent">konkrétní měsíční ztrátu v korunách</span> a opravíme je.
              První analýzu dostanete do hodiny zdarma.
            </p>

            <dl className="mt-9 grid max-w-md grid-cols-2 gap-6 border-t border-border pt-7">
              <div>
                <dd className="tnum display text-3xl font-extrabold leading-none">
                  {formatScannedShops(scannedShops)}
                </dd>
                <dt className="mt-2 text-xs text-muted-foreground">skenovaných e-shopů</dt>
              </div>
              <div>
                <dd className="tnum display text-3xl font-extrabold leading-none">10 minut</dd>
                <dt className="mt-2 text-xs text-muted-foreground">do doručení bezplatného scanu</dt>
              </div>
            </dl>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
              {reducers.map((item) => (
                <li key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <div id="analyza" className="rise scroll-mt-24 lg:col-span-5" style={{ animationDelay: '120ms' }}>
            <LeadForm variant="hero" />
          </div>
        </div>
      </div>

      <div className="relative border-y border-border bg-card/50">
        <div className="mx-auto flex max-w-screen-xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-5 sm:px-6 lg:px-8">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Skenujeme e-shopy na
          </span>
          {platforms.map((platform) => (
            <span key={platform} className="display text-base font-bold text-foreground/70">
              {platform}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="section-line bg-primary/[0.07] py-20 sm:py-28">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <h2>Do 10 minut budete vědět přesné číslo</h2>
            <p className="mt-5 text-muted-foreground">
              Místo dalšího odkládání dostanete seznam chyb seřazený podle toho, kolik vás každá měsíčně stojí. Bez
              platby, bez přístupů, bez závazku pokračovat.
            </p>
            <a
              href="#kalkulacka"
              className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-4"
            >
              Nejdřív si chci spočítat odhad
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <LeadForm variant="band" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="section-line py-14">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="display text-lg font-extrabold tracking-tight">
              GoFix<span className="text-primary">Web</span>
            </p>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Technické audity a opravy e-shopů. Měříme, vyčíslujeme, opravujeme.
            </p>
            <a
              href="mailto:info@gofixweb.com"
              className="mt-4 inline-block text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-4"
            >
              info@gofixweb.com
            </a>
          </div>

          <nav className="flex flex-col gap-3 text-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Navigace</span>
            {navLinks.map((link) => (
              <NavItem
                key={link.label}
                link={link}
                className="text-muted-foreground transition-colors duration-200 hover:md:text-foreground"
              />
            ))}
            <Link
              to="/vop"
              className="text-muted-foreground transition-colors duration-200 hover:md:text-foreground"
            >
              Obchodní podmínky
            </Link>
            <Link
              to="/ochrana-osobnich-udaju"
              className="text-muted-foreground transition-colors duration-200 hover:md:text-foreground"
            >
              Ochrana osobních údajů
            </Link>
          </nav>
        </div>

        <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          © 2026 GoFixWeb. Všechna práva vyhrazena.
        </p>
      </div>
    </footer>
  );
}

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <LossCalculator />
        <HowItWorks />
        <SocialProof />
        <Pricing />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}