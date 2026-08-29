/**
 * The agent emblem — a small four-point spark glyph, inline as a data-URI
 * SVG so this component has zero filesystem/public-asset dependency (a
 * prior operator's PNG at public/vantage-emblem.png never existed in this
 * repo, so every agent card rendered an invisible mask and every page load
 * threw a 404 — found live via Playwright, see tests/e2e/smoke.spec.ts).
 *
 * The glyph is used as a CSS mask over a solid color, so `shade` tints it
 * to any color — black for the Conductor, each department's life-area
 * color for its agents, etc.
 */
export const EMBLEM_MINT = '#00ffab';

// A simple 4-point spark/diamond, no brand identity — neutral machinery
// mark per the "machinery, not mascots" rule already documented in
// app/globals.css's .emblem block.
const SPARK_SVG =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 1 L20 12 L31 16 L20 20 L16 31 L12 20 L1 16 L12 12 Z'/%3E%3C/svg%3E";

export function SparkIcon({
  size = 28,
  shade = 'var(--accent)',
  className = '',
}: {
  shade?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Agent"
      className={`emblem inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: shade,
        // color drives the hover drop-shadow glow (.emblem in globals.css)
        color: shade,
        WebkitMaskImage: `url("${SPARK_SVG}")`,
        maskImage: `url("${SPARK_SVG}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}
