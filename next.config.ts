import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfkit external so its bundled AFM font files resolve at runtime
  // (bundling breaks with "ENOENT: ...Helvetica.afm").
  serverExternalPackages: ['pdfkit'],
};

export default nextConfig;
