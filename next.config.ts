import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["better-sqlite3"],
  // 关掉左下角 Next.js dev tools 浮动按钮
  devIndicators: false,
};

export default nextConfig;
