import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal standalone server output for Docker runtime
  output: "standalone",
  // Lint is run separately in CI; don't fail prod builds on lint
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
