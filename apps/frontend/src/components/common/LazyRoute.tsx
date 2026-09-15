import React, { Suspense, ComponentType } from 'react';

/**
 * Clean, lightweight loading indicator without technical "Loading module..." text.
 */
export const RouteLoadingFallback: React.FC = () => (
  <div
    style={{
      minHeight: '35vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}
  >
    <div
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        border: '3px solid rgba(59, 130, 246, 0.2)',
        borderTopColor: '#3B82F6',
        animation: 'spin 0.7s linear infinite',
      }}
    />
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

/**
 * withLazy: Helper that wraps a dynamic import into a React.lazy component with Suspense fallback.
 * Automatically recovers from chunk load errors (e.g. following new production deployments) by reloading once.
 */
export function withLazy<P extends object>(
  importer: () => Promise<{ [key: string]: any }>,
  exportName?: string
): React.FC<P> {
  const loadWithRecovery = async (): Promise<{ default: ComponentType<P> }> => {
    try {
      const mod = await importer();
      const component = (exportName ? mod[exportName] : mod.default || Object.values(mod)[0]) as ComponentType<P>;
      return { default: component };
    } catch (error: any) {
      console.warn('Dynamic route chunk failed to load, evaluating reload recovery:', error);
      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.message?.includes('error loading dynamically imported module') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError && typeof window !== 'undefined') {
        const reloadKey = `chunk_reload_guard_${window.location.pathname}`;
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
          return new Promise(() => {}); // never resolve while reloading
        }
      }
      throw error;
    }
  };

  // Pre-trigger in test environment
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    try {
      loadWithRecovery();
    } catch {}
  }

  const LazyComponent = React.lazy(loadWithRecovery);

  return (props: P) => (
    <Suspense fallback={<RouteLoadingFallback />}>
      <LazyComponent {...props} />
    </Suspense>
  );
}
