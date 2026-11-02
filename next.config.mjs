// under a path next to other apps (jam.geyser.at/beats): BASE_PATH=/beats, set by tabs' launcher (deploy/jam.mjs)
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');
// where grooves are saved: tabs next door (/tabs/api), set by the same launcher — empty on beats.mo-tion.at
const JAM_API = (process.env.JAM_API || '').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: BASE_PATH || undefined,
  // NEXT_DIST_DIR lets a second build live next to the usual one (tabs' npm run nuc: .next-nuc)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  env: { BASE_PATH, JAM_API },
};

export default nextConfig;
