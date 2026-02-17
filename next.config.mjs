/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Canvas 관련 설정
    config.externals = config.externals || []
    config.externals.push({
      canvas: "canvas",
    })
    return config
  },
}

export default nextConfig
