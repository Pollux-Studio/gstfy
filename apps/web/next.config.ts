import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-777a4807ff3840c68f3e9eee2a113dba.r2.dev",
      },
    ],
  },
  reactCompiler: true,
  transpilePackages: ["@repo/core"],
};

export default nextConfig;
