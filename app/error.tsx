'use client';

import { useEffect } from 'react';

/**
 * Next.js App Router's error boundary convention (error.tsx) — catches
 * any render/render-lifecycle error in the route tree below it. Reports
 * the real error to the same error_logs sink API routes use
 * (POST /api/errors/client), then renders a real recovery UI (never a
 * blank white screen) with a reset button that re-mounts the segment.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch('/api/errors/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        message: error.message,
        stack: error.stack ?? null,
      }),
    }).catch(() => {
      // Reporting itself failing must never compound the render error.
    });
  }, [error]);

  return (
    <div style={{ padding: 40, fontFamily: 'ui-monospace, monospace' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700 }}>Bir şeyler bozuldu</h1>
      <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>{error.message}</p>
      <button
        onClick={reset}
        style={{
          marginTop: 16,
          padding: '8px 16px',
          border: '1px solid #444',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Tekrar dene
      </button>
    </div>
  );
}
