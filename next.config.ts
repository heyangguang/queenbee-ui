import type { NextConfig } from "next";

// 后端地址：服务端环境变量，不暴露给浏览器
const BACKEND_URL = process.env.QUEENBEE_API_URL || "http://localhost:3777";

const nextConfig: NextConfig = {
  output: "standalone",
  // 将 /api/* 请求代理到后端 queenbee 服务
  // 这样浏览器只需要访问前端地址，由 Next.js 服务端转发到后端
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
