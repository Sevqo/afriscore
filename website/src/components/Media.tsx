import { useState, type ReactNode, type CSSProperties } from 'react';
export type Media =
  | {
      kind: 'image' | 'svg' | 'screenshot';
      src: string;
      mobileSrc?: string;
      alt: string;
      aspectRatio?: string;
      fit?: 'cover' | 'contain';
      position?: string;
      background?: string;
      transparent?: boolean;
      eager?: boolean;
      animate?: boolean;
    }
  | {
      kind: 'video';
      src: string;
      poster: string;
      alt: string;
      aspectRatio?: string;
      animate?: boolean;
      background?: string;
    };
export function MediaBlock({ media }: { media: Media }) {
  const [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  const style: CSSProperties = {
    aspectRatio: media.aspectRatio || '4 / 3',
    background: media.kind !== 'video' ? media.background : undefined,
  };
  return (
    <figure
      className={`media-container ${media.animate ? 'animated-media' : ''} ${loaded ? 'loaded' : ''}`}
      style={style}
    >
      {failed ? (
        <div role="status" className="media-fallback">
          {media.alt} · Preview unavailable
        </div>
      ) : media.kind === 'video' ? (
        <video
          controls
          playsInline
          preload="metadata"
          poster={media.poster}
          aria-label={media.alt}
          onError={() => setFailed(true)}
        >
          <source src={media.src} />
        </video>
      ) : (
        <picture>
          {media.mobileSrc && (
            <source media="(max-width: 640px)" srcSet={media.mobileSrc} />
          )}
          <img
            src={media.src}
            alt={media.alt}
            loading={media.eager ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{
              objectFit: media.fit || 'contain',
              objectPosition: media.position || 'center',
            }}
          />
        </picture>
      )}
    </figure>
  );
}
export const HeroMedia = MediaBlock;
export const ProductShowcase = MediaBlock;
export function FeatureSection({
  eyebrow,
  title,
  description,
  media,
  reverse = false,
  dark = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  media: Media;
  reverse?: boolean;
  dark?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className={`feature ${reverse ? 'reverse' : ''} ${dark ? 'dark' : ''}`}
    >
      <div className="section-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </div>
      <MediaBlock media={media} />
    </section>
  );
}
export const MediaTextSection = FeatureSection;
export const EducationalSection = FeatureSection;
export function EditorialCard({
  title,
  text,
  href,
  media,
}: {
  title: string;
  text: string;
  href: string;
  media: Media;
}) {
  return (
    <article className="editorial-card">
      <a href={href}>
        <MediaBlock media={media} />
        <div className="card-copy">
          <h3>
            {title} <span aria-hidden="true">↗</span>
          </h3>
          <p>{text}</p>
        </div>
      </a>
    </article>
  );
}
export function MediaCarousel({ children }: { children: ReactNode }) {
  return (
    <div
      className="media-carousel"
      tabIndex={0}
      aria-label="Explore solutions; scroll horizontally"
    >
      {children}
    </div>
  );
}
