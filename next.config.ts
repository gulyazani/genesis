import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["grammy"],
  agentRules: false,
};

export default nextConfig;
