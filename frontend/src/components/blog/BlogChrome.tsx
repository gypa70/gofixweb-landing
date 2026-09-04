import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const navLinks = [
  { label: 'Jak to funguje', href: '/#jak-to-funguje' },
  { label: 'Kalkulačka', href: '/#kalkulacka' },
  { label: 'Výsledky', href: '/#vysledky' },
  { label: 'Ceník', href: '/#ceny' },
  { label: 'FAQ', href: '/#faq' },
];

type BlogChromeProps = {
  children: ReactNode;
};

/**
 * Shared blog shell that reuses the landing page header/footer so the blog
 * feels native instead of looking like a bolted-on section.
 */
const BlogChrome = ({ children }: BlogChromeProps) => (
  <div className="flex min-h-screen flex-col bg-background">
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="display shrink-0 text-lg font-extrabold tracking-tight">
          GoFix<span className="text-primary">Web</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:md:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Button
          asChild
          className="ml-auto h-10 bg-primary px-5 font-bold text-primary-foreground transition-colors duration-200 hover:md:bg-primary/90 lg:ml-0"
        >
          <a href="/#analyza">Bezplatná analýza</a>
        </Button>
      </div>
    </header>

    <main className="flex-1">{children}</main>

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
              <a
                key={link.href}
                href={link.href}
                className="text-muted-foreground transition-colors duration-200 hover:md:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/blog/"
              className="text-muted-foreground transition-colors duration-200 hover:md:text-foreground"
            >
              Blog
            </Link>
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
  </div>
);

export default BlogChrome;