import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button.js';

export interface NotFoundPageProps {
  title?: string;
  description?: string;
  showHomeButton?: boolean;
  'data-testid'?: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  title = 'Page Not Found',
  description = "The page you are looking for doesn't exist, has been moved, or is temporarily unavailable.",
  showHomeButton = true,
  'data-testid': testId = 'not-found-page',
}) => {
  const navigate = useNavigate();

  return (
    <div
      data-testid={testId}
      style={{
        minHeight: '80vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8, 2rem) var(--space-4, 1rem)',
        backgroundColor: '#050914',
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(16, 185, 129, 0.07) 0%, rgba(5, 9, 20, 0.98) 75%)',
        color: '#FFFFFF',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Soft Ambient Background Glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
          padding: 'var(--space-8, 2rem)',
          borderRadius: 'var(--radius-xl, 1rem)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Minimal Compass Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.22)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary-bright, #22C55E)',
            marginBottom: 'var(--space-4, 1rem)',
          }}
        >
          <Compass size={28} strokeWidth={2.2} />
        </div>

        {/* Minimal 404 Badge */}
        <div
          style={{
            fontSize: 'var(--font-size-3xs, 0.75rem)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-primary-bright, #22C55E)',
            marginBottom: 'var(--space-2, 0.5rem)',
          }}
        >
          404 • Lost in the Grid
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
            margin: '0 0 var(--space-3, 0.75rem) 0',
            color: '#FFFFFF',
          }}
        >
          {title}
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 'var(--font-size-sm, 0.875rem)',
            color: 'rgba(255, 255, 255, 0.68)',
            lineHeight: 1.6,
            margin: '0 0 var(--space-6, 1.5rem) 0',
          }}
        >
          {description}
        </p>

        {/* Action Controls */}
        {showHomeButton && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/')}
              style={{ minWidth: '160px' }}
            >
              <ArrowLeft size={16} style={{ marginRight: '0.4rem' }} />
              Return to Home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotFoundPage;
