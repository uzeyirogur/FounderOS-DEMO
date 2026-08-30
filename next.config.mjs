/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolate the build output dir via env so a production build can run on its
  // own port without clobbering a concurrent `next dev` (which keeps `.next`).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'node-ical', 'nodemailer'],
    // Enables instrumentation.ts's register() hook (Next 14 requires this
    // flag explicitly; it's the mechanism the in-process scheduler
    // (lib/scheduler/in-process.ts) uses to start on server boot without
    // a separate process or an external ticker.
    instrumentationHook: true,
  },
};

export default nextConfig;
