import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid failing production builds on local ESLint setup issues.
  // (You can still run ESLint separately via npm scripts.)
  eslint: {
    ignoreDuringBuilds: true
  },
  // If you have multiple lockfiles on your machine, Next can infer the wrong
  // workspace root. Force tracing to this project directory.
  outputFileTracingRoot: __dirname,
  experimental: {
    // keep defaults; we avoid bleeding-edge flags for stability
  }
};

export default nextConfig;
