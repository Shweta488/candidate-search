import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep CLAUDE.md as the project wrote it; next dev would otherwise append its own agent block.
  agentRules: false,
  // The floating dev-tools button covers content in screenshots and Cypress runs.
  devIndicators: false,
};

export default nextConfig;
