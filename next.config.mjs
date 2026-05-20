const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://circles.gnosis.io https://*.gnosis.io https://miniapps.aboutcircles.com https://*.aboutcircles.com https://circles-dev.gnosis.io",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
