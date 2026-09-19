/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Native / WASM-backed packages must not be bundled by webpack.
    serverComponentsExternalPackages: ["pdf-parse", "mammoth", "@xenova/transformers", "onnxruntime-node", "sharp"],
  },
};

module.exports = nextConfig;
