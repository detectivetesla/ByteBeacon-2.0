import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Floating WhatsApp community button.
 * Draggable, snaps to edges, opens community link on click.
 */

const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/Jpmtz6kPYbR6bcYV63MiQi';

const WHATSAPP_SVG = (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="#FFFFFF">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export const WhatsAppFloat: React.FC = () => {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [dragging, setDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Set initial position (bottom-right)
  useEffect(() => {
    setPos({
      x: window.innerWidth - 76,
      y: window.innerHeight - 90,
    });
  }, []);

  const clamp = useCallback((val: number, min: number, max: number) => {
    return Math.min(Math.max(val, min), max);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!btnRef.current) return;
    setDragging(true);
    setHasDragged(false);
    const rect = btnRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    btnRef.current.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setHasDragged(true);
    const size = 56;
    setPos({
      x: clamp(e.clientX - dragOffset.current.x, 0, window.innerWidth - size),
      y: clamp(e.clientY - dragOffset.current.y, 0, window.innerHeight - size),
    });
  }, [dragging, clamp]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    try {
      btnRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    // Snap to nearest horizontal edge
    const size = 56;
    const midX = pos.x + size / 2;
    const snapX = midX < window.innerWidth / 2 ? 16 : window.innerWidth - size - 16;
    setPos((prev) => ({
      x: snapX,
      y: clamp(prev.y, 16, window.innerHeight - size - 16),
    }));

    // If it was just a click (not a drag), open the link
    if (!hasDragged) {
      window.open(WHATSAPP_COMMUNITY_URL, '_blank', 'noopener,noreferrer');
    }
  }, [dragging, pos.x, hasDragged, clamp]);

  // Don't render until position is initialized
  if (pos.x === -1) return null;

  return (
    <>
      <style>{`
        @keyframes wa-float-pulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35); }
          50% { box-shadow: 0 6px 20px rgba(37, 211, 102, 0.55); }
        }
        .wa-float-btn {
          animation: wa-float-pulse 2.5s ease-in-out infinite;
        }
        .wa-float-btn:hover {
          transform: scale(1.08);
        }
        .wa-float-btn:active {
          transform: scale(0.96);
        }
        @media (prefers-reduced-motion: reduce) {
          .wa-float-btn {
            animation: none !important;
          }
        }
      `}</style>
      <a
        ref={btnRef}
        href={WHATSAPP_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="wa-float-btn"
        aria-label="Join our WhatsApp community"
        onClick={(e) => {
          // Prevent default navigation if dragging
          if (hasDragged) e.preventDefault();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 9999,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          transition: dragging
            ? 'none'
            : 'left 0.3s cubic-bezier(0.16, 1, 0.3, 1), top 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s ease',
          textDecoration: 'none',
          border: '2px solid rgba(255, 255, 255, 0.25)',
        }}
      >
        {WHATSAPP_SVG}

        {/* Tooltip */}
        {tooltipVisible && !dragging && (
          <span
            style={{
              position: 'absolute',
              bottom: '110%',
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              backgroundColor: 'var(--color-bg-surface-elevated, #1a1a2e)',
              color: 'var(--color-text-primary, #fff)',
              fontSize: '12px',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
            }}
          >
            Join our Community
          </span>
        )}
      </a>
    </>
  );
};
