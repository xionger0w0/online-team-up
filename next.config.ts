import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isGitHubPages ? "/online-team-up" : "",
  assetPrefix: isGitHubPages ? "/online-team-up/" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
