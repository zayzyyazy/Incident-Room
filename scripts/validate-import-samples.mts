#!/usr/bin/env npx tsx
import fs from "node:fs";
import path from "node:path";
import { normalizeImportedJson } from "../src/lib/normalizer/import-evidence";

const dir = path.join(process.cwd(), "fixtures", "imports");
const manifest = JSON.parse(
  fs.readFileSync(path.join(dir, "manifest.json"), "utf8"),
) as { samples: Array<{ id: string; file: string }> };

let failed = 0;
for (const sample of manifest.samples) {
  const raw = fs.readFileSync(path.join(dir, sample.file), "utf8");
  try {
    const { evidence, report } = normalizeImportedJson(raw);
    const badTools = evidence.layer2_execution.function_calls.filter(
      (c) => c.status !== "success",
    );
    console.log(
      `✓ ${sample.id} [${report.platform}] turns=${report.mapped.transcript_turns} tools=${report.mapped.tool_calls} failures=${badTools.map((t) => t.name).join(",") || "none"}`,
    );
  } catch (error) {
    failed++;
    console.error(`✗ ${sample.id}`, error);
  }
}
process.exit(failed > 0 ? 1 : 0);
