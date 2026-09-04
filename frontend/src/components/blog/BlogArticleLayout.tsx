import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BlogChrome from '@/components/blog/BlogChrome';

type BlogArticleLayoutProps = {
  title: string;
  description?: string;
  displayDate?: string;
  tags?: string[];
  children: ReactNode;
};

const BlogArticleLayout = ({
  title,
  description,
  displayDate,
  tags,
  children,
}: BlogArticleLayoutProps) => (
  <BlogChrome>
    <article className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <Link
        to="/blog/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:md:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Zpět na blog
      </Link>

      <header className="mt-8 border-b border-border pb-9">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Blog</span>
          {displayDate ? (
            <span className="tnum text-xs text-muted-foreground">{displayDate}</span>
          ) : null}
        </div>

        <h1 className="mt-5 text-[clamp(1.8rem,2.6vw+1rem,2.7rem)]">{title}</h1>

        {description ? (
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{description}</p>
        ) : null}

        {tags && tags.length > 0 ? (
          <ul className="mt-6 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="mt-10">{children}</div>

      <aside className="mt-14 rounded-lg border border-primary/25 bg-primary/[0.07] p-6 sm:p-8">
        <h2 className="display text-xl font-extrabold tracking-tight">
          Chcete stejný sken na svém e-shopu?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Report běží na veřejných datech z Google PageSpeed — bez platební karty a bez přístupů do
          administrace.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            asChild
            className="h-11 bg-primary px-5 font-bold text-primary-foreground transition-colors duration-200 hover:md:bg-primary/90"
          >
            <a href="/#analyza">
              Bezplatná analýza
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
          <Button
            asChild
            className="h-11 !bg-transparent px-5 text-sm font-semibold text-foreground ring-1 ring-inset ring-border transition-colors duration-200 hover:md:!bg-transparent hover:md:ring-primary/60"
          >
            <a href="/#ceny">Ceník</a>
          </Button>
        </div>
      </aside>
    </article>
  </BlogChrome>
);

export default BlogArticleLayout;