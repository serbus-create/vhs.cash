/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer', 'puppeteer-core', '@sparticuz/chromium'],
  },
}

module.exports = nextConfig
