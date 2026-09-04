import type { AnchorHTMLAttributes } from 'react';
import Markdown from 'markdown-to-jsx';

type MarkdownArticleProps = {
  markdown: string;
};

function isExternalHref(href?: string) {
  return Boolean(href) && /^https?:\/\//i.test(href as string);
}

/**
 * Links inside the archived article text point either to in-app landing anchors
 * (`/#analyza`) or to external references (pagespeed.web.dev). External ones open
 * in a new tab, in-app ones stay in the same tab and scroll to the section.
 */
const ArticleLink = ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const external = isExternalHref(href);

  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener' } : {})}
      className="font-semibold text-primary underline decoration-primary/40 underline-offset-4 transition-colors duration-200 hover:md:decoration-primary"
      {...rest}
    >
      {children}
    </a>
  );
};

const MarkdownArticle = ({ markdown }: MarkdownArticleProps) => (
  <div
    className="
      prose prose-invert max-w-none
      prose-headings:display prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:text-foreground
      prose-h2:mt-12 prose-h2:border-t prose-h2:border-border prose-h2:pt-8 prose-h2:text-[clamp(1.3rem,1.1vw+1rem,1.65rem)] prose-h2:leading-snug
      prose-h3:mt-9 prose-h3:text-xl prose-h3:leading-snug
      prose-p:text-[1.02rem] prose-p:leading-[1.8] prose-p:text-muted-foreground
      prose-li:text-[1.02rem] prose-li:leading-[1.8] prose-li:text-muted-foreground
      prose-strong:font-bold prose-strong:text-foreground
      prose-ul:my-6 prose-ol:my-6
      prose-code:rounded prose-code:border prose-code:border-border prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.88em] prose-code:font-semibold prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none
      prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-pre:bg-card prose-pre:p-5
      marker:text-primary
    "
  >
    <Markdown
      options={{
        forceBlock: true,
        overrides: {
          a: { component: ArticleLink },
        },
      }}
    >
      {markdown}
    </Markdown>
  </div>
);

export default MarkdownArticle;