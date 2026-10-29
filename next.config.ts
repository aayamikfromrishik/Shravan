import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The PDF reader runs on the server as a normal Node package.
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', './data/**/*'],
  },
};

export default nextConfig;
