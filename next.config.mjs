/** @type {import('next').NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserOrOrgPagesRepo = repository.endsWith(".github.io");
const basePath = isGithubActions && !isUserOrOrgPagesRepo ? `/${repository}` : "";

const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  experimental: {
    esmExternals: true
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;
