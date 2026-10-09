import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Requirements content lives in the repo and is read from the filesystem,
  // so keep the pages dynamic (fresh on every request).

  // Allow local dev access via nginx vhost (http://pp2.com -> 127.0.0.1:41000).
  // Without this, Next.js dev blocks cross-origin requests to /_next/hmr
  // and client interactions break when the page is opened via the proxy host.
  allowedDevOrigins: ["pp2.com", "127.0.0.1"],
};

export default nextConfig;
