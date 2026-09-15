import React, { Suspense } from 'react';

/**
 * Sleek loading fallback for code-split lazy routes.
 */
export const RouteLoadingFallback: React.FC = () => (
  <div
    style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      padding: '2rem',
    }}
  >
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        border: '3px solid var(--color-border-subtle, rgba(255, 255, 255, 0.15))',
        borderTopColor: '#3B82F6',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <span
      style={{
        fontSize: 'var(--font-size-xs, 0.75rem)',
        color: 'var(--color-text-muted, #94A3B8)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      Loading module...
    </span>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

/**
 * withLazy: Helper that wraps a dynamic import into a React.lazy component with Suspense fallback.
 * Automatically handles both default and named export modules.
 */
export function withLazy<P extends object>(
  importer: () => Promise<{ [key: string]: any }>,
  exportName?: string
): React.FC<P> {
  let resolvedComponent: React.ComponentType<P> | null = null;
  let importPromise: Promise<{ default: React.ComponentType<P> }> | null = null;

  const load = () => {
    if (!importPromise) {
      importPromise = importer().then((mod) => {
        const component = (exportName ? mod[exportName] : mod.default || Object.values(mod)[0]) as React.ComponentType<P>;
        resolvedComponent = component;
        return { default: component };
      });
    }
    return importPromise;
  };

  // In test environment, pre-trigger load to ensure smooth synchronous-like resolution in test runners
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    try {
      load();
    } catch {
      // Ignore in non-Node environments
    }
  }

  const LazyComponent = React.lazy(load);

  return (props: P) => {
    if (resolvedComponent) {
      const Comp = resolvedComponent;
      return <Comp {...props} />;
    }

    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
