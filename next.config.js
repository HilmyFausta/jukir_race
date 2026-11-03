/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev tanpa `vercel dev`: teruskan /api/* ke Flask lokal (python api/index.py, port 5328).
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [{ source: "/api/:path*", destination: "http://127.0.0.1:5328/api/:path*" }];
    }
    return [];
  },
};
module.exports = nextConfig;
