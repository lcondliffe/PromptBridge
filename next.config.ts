import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal standalone server output for Docker runtime
  output: "standalone",
  // Transpile local workspace packages when imported
  transpilePackages: ["@promptbridge/sdk", "@promptbridge/api"],
  // Lint is run separately in CI; don't fail prod builds on lint
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Add PostHog rewrites
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
