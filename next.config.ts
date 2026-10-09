import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep CLAUDE.md as the project wrote it; next dev would otherwise append its own agent block.
  agentRules: false,
};

export default nextConfig;
