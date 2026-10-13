/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer', 'puppeteer-core', '@sparticuz/chromium'],
  },
  // Veřejné potvrzovací cesty: nic se nesmí cachovat ani posílat v Referer
  async headers() {
    const publicHeaders = [
      { key: 'Cache-Control', value: 'no-store' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ]
    return [
      { source: '/potvrzeni/:path*', headers: publicHeaders },
      { source: '/api/potvrzeni/:path*', headers: publicHeaders },
    ]
  },
}

module.exports = nextConfig
