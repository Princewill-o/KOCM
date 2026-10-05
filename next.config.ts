import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/dashboard', headers: [
      { key: 'Permissions-Policy', value: 'display-capture=()' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'Referrer-Policy', value: 'same-origin' },
    ] }];
  },
};

export default nextConfig;
