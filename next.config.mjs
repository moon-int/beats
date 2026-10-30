// under a path next to other apps (jam.geyser.at/beats): BASE_PATH=/beats, set by tabs' launcher (deploy/jam.mjs)
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: BASE_PATH || undefined,
  // NEXT_DIST_DIR lets a second build live next to the usual one (tabs' npm run nuc: .next-nuc)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  env: { BASE_PATH },
};

export default nextConfig;
