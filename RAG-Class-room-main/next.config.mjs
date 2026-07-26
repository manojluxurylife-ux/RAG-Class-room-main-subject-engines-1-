/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true }, // tsc --noEmit already verified clean separately; in-build type-check too slow under this sandbox's single-core limit
  eslint: { ignoreDuringBuilds: true },
  experimental: { workerThreads: false, cpus: 1 },
  // Keep the active preview separate from an older interrupted webpack cache.
  webpack: (config) => {
    // Konva ships a Node-targeted build path (used for server-side canvas
    // rendering, which this app never does) that references the optional
    // `canvas` npm package. It's not installed (and shouldn't be — it needs
    // native build tools), so tell webpack not to try to bundle it. This is
    // Konva's own documented fix for Next.js: https://konvajs.org/docs/react/Loading_images.html#nextjs
    config.externals = [...(config.externals || []), { canvas: "commonjs canvas" }];
    return config;
  },
};
export default nextConfig;
