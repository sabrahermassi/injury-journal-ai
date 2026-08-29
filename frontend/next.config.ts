import type { NextConfig } from "next";

// The Express API (this repo's backend) runs separately -- default port 3000,
// see src/config/port.ts. Proxying /ai-agent keeps the browser on a single
// origin, so no ALLOWED_ORIGIN/CORS configuration is needed for local dev.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  // The repo root has its own package-lock.json for the Express backend, so
  // pin the workspace root here rather than letting Turbopack infer it.
  turbopack: { root: __dirname },

  async rewrites() {
    return [
      { source: "/ai-agent", destination: `${apiOrigin}/ai-agent` },
      { source: "/injuries", destination: `${apiOrigin}/injuries` },
    ];
  },
};

export default nextConfig;
