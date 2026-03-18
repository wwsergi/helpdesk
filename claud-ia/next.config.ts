import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/ai',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/ai',
  },
  async headers() {
    return [
      {
        // Allow the widget page to be embedded in any cross-origin iframe
        source: '/widget',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *",
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
