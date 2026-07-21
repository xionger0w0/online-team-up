import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isGitHubPages ? "/UNNC-FreshMan-TeamUP" : "",
  assetPrefix: isGitHubPages ? "/UNNC-FreshMan-TeamUP/" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
