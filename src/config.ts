import type { AgentConfig } from "./types";

export const DEFAULT_CONFIG: AgentConfig = {
  model: "claude-opus-4-6",
  maxTokens: 2048,
  enableKBSearch: true,
  enableCustomerHistory: true,
  logTiming: true,
};

export function createConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
