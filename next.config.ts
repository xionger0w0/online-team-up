import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isGitHubPages ? "/UNNC-NewStudent-TeamUP" : "",
  assetPrefix: isGitHubPages ? "/UNNC-NewStudent-TeamUP/" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
