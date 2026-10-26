import { Icon } from './Icon';
import {
  useId,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
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
          <span className="card-category">AfriCore · Business solutions</span>
          <h3>
            {title}{' '}
            <span aria-hidden="true">
              <Icon name="right" />
            </span>
          </h3>
          <p>{text}</p>
        </div>
      </a>
    </article>
  );
}
export function MediaCarousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null),
    id = useId();
  const [position, setPosition] = useState({ start: true, end: false });
  function move(direction: number) {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector('article');
    const step =
      (card?.getBoundingClientRect().width || el.clientWidth * 0.85) + 24;
    el.scrollBy({
      left: direction * step,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }
  return (
    <div className="carousel-section">
      <div
        id={id}
        ref={ref}
        className="media-carousel"
        tabIndex={0}
        role="region"
        aria-label="Business solutions"
        onScroll={(e) => {
          const el = e.currentTarget;
          setPosition({
            start: el.scrollLeft < 4,
            end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
          });
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            move(e.key === 'ArrowRight' ? 1 : -1);
          }
        }}
      >
        {children}
      </div>
      <div className="carousel-controls">
        <span>Explore the possibilities</span>
        <button
          className="icon-button"
          aria-label="Previous solution"
          aria-controls={id}
          disabled={position.start}
          onClick={() => move(-1)}
        >
          <Icon name="left" />
        </button>
        <button
          className="icon-button"
          aria-label="Next solution"
          aria-controls={id}
          disabled={position.end}
          onClick={() => move(1)}
        >
          <Icon name="right" />
        </button>
      </div>
    </div>
  );
}
