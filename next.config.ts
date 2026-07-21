import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(isGitHubPages ? {
    output: "export" as const,
    basePath: "/homebuyer-agent",
    assetPrefix: "/homebuyer-agent",
    trailingSlash: true
  } : {})
};

export default nextConfig;
