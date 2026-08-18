import React, { useState, useEffect, useCallback } from 'react';

/**
 * Rotating background image system for auth pages.
 *
 * Crossfades between 5 images on a 10-second interval with a subtle
 * Ken Burns zoom (100% → 103%). Respects prefers-reduced-motion.
 */

const AUTH_IMAGES = [
  '/auth/bg-1.jpg',
  '/auth/bg-2.jpg',
  '/auth/bg-3.jpg',
  '/auth/bg-4.jpg',
  '/auth/bg-5.jpg',
];

/** Per-image overlay opacity: heavier for light images, lighter for dark */
const IMAGE_OVERLAY_OPACITY = [0.55, 0.55, 0.55, 0.40, 0.40];

const IMAGE_DURATION = 10_000;       // 10 seconds
const CROSSFADE_DURATION = 1_300;    // 1.3 seconds
const KEN_BURNS_SCALE = 1.03;       // 100% → 103%
const TOTAL_CYCLE = IMAGE_DURATION + CROSSFADE_DURATION; // 11.3s per image

export interface AuthBackgroundProps {
  /** Which image index to start the rotation from (default 0) */
  startIndex?: number;
}

export const AuthBackground: React.FC<AuthBackgroundProps> = ({ startIndex = 0 }) => {
  const [activeIndex, setActiveIndex] = useState(startIndex % AUTH_IMAGES.length);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Detect reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Preload all images on mount
  useEffect(() => {
    AUTH_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Image rotation timer
  const advance = useCallback(() => {
    const next = (activeIndex + 1) % AUTH_IMAGES.length;
    setNextIndex(next);
    setTransitioning(true);

    // After crossfade completes, promote next → active
    const timer = setTimeout(() => {
      setActiveIndex(next);
      setNextIndex(null);
      setTransitioning(false);
    }, CROSSFADE_DURATION);

    return () => clearTimeout(timer);
  }, [activeIndex]);

  useEffect(() => {
    const interval = setInterval(advance, IMAGE_DURATION);
    return () => clearInterval(interval);
  }, [advance]);

  // Shared image layer styles
  const imageLayerBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    willChange: 'transform, opacity',
  };

  // Dynamic overlay opacity for the currently visible image
  const currentOverlay = IMAGE_OVERLAY_OPACITY[activeIndex] ?? 0.50;
  const nextOverlay = nextIndex !== null ? (IMAGE_OVERLAY_OPACITY[nextIndex] ?? 0.50) : currentOverlay;
  // Blend overlay during transition
  const overlayOpacity = transitioning
    ? nextOverlay
    : currentOverlay;

  return (
    <>
      {/* CSS Keyframes for Ken Burns */}
      <style>{`
        @keyframes auth-ken-burns {
          from { transform: scale(1); }
          to   { transform: scale(${KEN_BURNS_SCALE}); }
        }

        .auth-bg-layer {
          animation: ${isReducedMotion ? 'none' : `auth-ken-burns ${TOTAL_CYCLE}ms ease-out forwards`};
        }

        @media (max-width: 640px) {
          .auth-overlay-mobile-boost {
            opacity: 0.62 !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-bg-layer {
            animation: none !important;
          }
        }
      `}</style>

      {/* Background container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          zIndex: 0,
        }}
        aria-hidden="true"
      >
        {/* Active image layer */}
        <div
          key={`active-${activeIndex}`}
          className="auth-bg-layer"
          style={{
            ...imageLayerBase,
            backgroundImage: `url(${AUTH_IMAGES[activeIndex]})`,
            opacity: 1,
            transition: `opacity ${CROSSFADE_DURATION}ms ease-in-out`,
            ...(transitioning ? { opacity: 0 } : {}),
          }}
        />

        {/* Next image layer (fades in during transition) */}
        {nextIndex !== null && (
          <div
            key={`next-${nextIndex}`}
            className="auth-bg-layer"
            style={{
              ...imageLayerBase,
              backgroundImage: `url(${AUTH_IMAGES[nextIndex]})`,
              opacity: transitioning ? 1 : 0,
              transition: `opacity ${CROSSFADE_DURATION}ms ease-in-out`,
            }}
          />
        )}

        {/* Dark obsidian overlay */}
        <div
          className="auth-overlay-mobile-boost"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: `rgba(8, 11, 18, ${overlayOpacity})`,
            transition: `background-color ${CROSSFADE_DURATION}ms ease-in-out`,
          }}
        />

        {/* Subtle ByteBeacon green radial gradient tint */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 30% 60%, rgba(22, 163, 74, 0.10) 0%, transparent 65%), ' +
              'radial-gradient(ellipse at 70% 30%, rgba(6, 182, 212, 0.06) 0%, transparent 55%)',
            pointerEvents: 'none',
          }}
        />

        {/* Subtle noise texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'repeat',
            backgroundSize: '128px 128px',
            pointerEvents: 'none',
          }}
        />
      </div>
    </>
  );
};
