import fs from "fs";
import path from "path";
import { AgentPlatform } from "@/lib/canonical/surface-types";

export type LeapingAgentSlice = {
  id: string;
  name: string;
  platform?: string;
  system_message_excerpt?: string;
  system_message?: string;
  stages: Array<{
    id: string;
    name: string;
    type: string;
    field_name?: string;
    value?: unknown;
    functions?: string[];
    stage_message?: string;
    transitions?: Array<{
      id?: string;
      to?: string;
      name?: string;
      description?: string;
    }>;
  }>;
  functions: Array<{
    name: string;
    type: string;
    method?: string;
    description?: string;
  }>;
};

export type RuntimeToolAliasManifest = {
  platform: AgentPlatform;
  artifact: string;
  aliases: Record<string, string>;
};

export function loadLeapingAgentSlice(name: string): LeapingAgentSlice {
  const filePath = path.join(
    process.cwd(),
    "fixtures/agent",
    `${name}.json`,
  );
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as LeapingAgentSlice;
}

export function loadRuntimeToolAliases(
  incidentId: string,
): RuntimeToolAliasManifest | null {
  const filePath = path.join(
    process.cwd(),
    "fixtures/agent/runtime-tool-aliases.json",
  );
  if (!fs.existsSync(filePath)) return null;
  const map = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
    string,
    RuntimeToolAliasManifest
  >;
  return map[incidentId] ?? null;
}
