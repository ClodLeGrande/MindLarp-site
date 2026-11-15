const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  outputFileTracingIncludes: {
    '/': ['./db/migrations/*.sql'],
  },
  async rewrites() {
    return [{ source: '/assets/:path*', destination: '/:path*' }];
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;
