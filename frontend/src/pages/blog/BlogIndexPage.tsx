import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import BlogChrome from '@/components/blog/BlogChrome';
import { blogPosts, getBlogRoute } from '@/lib/blog';
import type { BlogPost } from '@/lib/blog';

function readString(post: BlogPost, key: string) {
  const value = post.frontmatter[key];
  return typeof value === 'string' ? value : undefined;
}

const BlogIndexPage = () => (
  <BlogChrome>
    <section className="mx-auto w-full max-w-screen-xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="max-w-2xl">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Blog</span>
        <h1 className="mt-4 text-[clamp(1.9rem,3vw+1rem,2.8rem)]">
          Co měříme na e-shopech a co z toho <span className="text-primary">reálně plyne</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Konkrétní nálezy z veřejných skenů, postupy, které jdou ověřit z prohlížeče, a hranice
          toho, co umíme opravit automaticky. Bez slibů o desítkách pozic.
        </p>
      </div>

      <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        {blogPosts.map((post) => {
          const displayDate = readString(post, 'display_date');
          const tags = post.frontmatter.tags ?? [];

          return (
            <article
              key={post.slug}
              className="flex flex-col bg-card p-6 transition-colors duration-200 hover:md:bg-secondary/60 sm:p-8"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {displayDate ? (
                  <span className="tnum text-xs text-muted-foreground">{displayDate}</span>
                ) : null}
                {tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <h2 className="mt-4 display text-xl font-extrabold leading-snug tracking-tight">
                <Link
                  to={getBlogRoute(post.slug)}
                  className="transition-colors duration-200 hover:md:text-primary"
                >
                  {post.title}
                </Link>
              </h2>

              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                {post.description}
              </p>

              <Link
                to={getBlogRoute(post.slug)}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-4"
              >
                Číst článek
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </div>

      <div className="mt-14 border-t border-border pt-8">
        <p className="text-sm text-muted-foreground">
          Nechcete čekat na další článek? Sken vašeho e-shopu běží na veřejných datech a je zdarma.
        </p>
        <a
          href="/#analyza"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-4"
        >
          Bezplatný report do 10 minut
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  </BlogChrome>
);

export default BlogIndexPage;