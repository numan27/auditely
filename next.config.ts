import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@react-pdf/renderer"],
  // Read from disk at run time (the outreach email's logo), so the build can't see it's needed
  outputFileTracingIncludes: {
    "/api/send-email": ["./app/_shared/assets/images/devartventuresLogo.png"],
  },
  images: {
    formats: ["image/webp", "image/avif"],
    // No remote images are used. Add explicit hostnames here if that changes;
    // never a "**" wildcard (it turns /_next/image into an open image proxy).
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
