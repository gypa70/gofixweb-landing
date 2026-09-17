const VIDEO_SRC = '/videos/gofixweb-promo.mp4?v=13389281';
const VIDEO_POSTER = '/images/video-poster.jpg?v=13378970';

export default function VideoSection() {
  return (
    <section id="video" className="section-line bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Video</span>
          <h2 className="mt-4">Co uvidíte v auditu, ještě než se rozhodnete opravovat</h2>
          <p className="mt-5 text-muted-foreground">
            Krátké představení skenu, vyčíslení ztráty a měřitelného před/po. Video se nespouští samo — ovládáte ho
            klasickými ovladači prohlížeče.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-lg border-2 border-primary/45 bg-black">
          <video
            className="aspect-video w-full bg-black"
            controls
            playsInline
            preload="none"
            poster={VIDEO_POSTER}
            title="GoFixWeb — jak vypadá audit e-shopu"
          >
            <source src={VIDEO_SRC} type="video/mp4" />
            Váš prohlížeč video nezobrazí. Soubor je na{' '}
            <a href={VIDEO_SRC} className="text-primary underline">
              {VIDEO_SRC}
            </a>
            .
          </video>
        </div>
      </div>
    </section>
  );
}
