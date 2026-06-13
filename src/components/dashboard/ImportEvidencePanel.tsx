"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@/components/ui/shell";

export function ImportEvidencePanel({ onImported }: { onImported: () => void }) {
  const router = useRouter();
  const [rawJson, setRawJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawJson }),
      });

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error ?? "Import failed");
      }

      setRawJson("");
      onImported();
      router.push(`/incidents/${data.incident.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Import evidence JSON">
      <div className="space-y-3 p-4">
        <p className="text-xs text-room-muted">
          Paste a{" "}
          <code className="text-trace">VoiceIncidentEvidence</code> bundle. The
          orchestrator will run your agents against it and post results to Band.
        </p>
        <textarea
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          placeholder='{"incident_id":"...","source_platform":"leaping","title":"...","layer1_conversation":{...},"layer2_execution":{...}}'
          className="h-40 w-full resize-y rounded-lg border border-room-border bg-room-bg p-3 font-mono text-xs text-foreground outline-none ring-trace/30 focus:ring-2"
        />
        {error ? <p className="text-xs text-alert">{error}</p> : null}
        <button
          type="button"
          onClick={handleImport}
          disabled={loading || rawJson.trim().length < 10}
          className="rounded-lg border border-trace/40 bg-trace/10 px-4 py-2 text-sm font-medium text-trace transition hover:bg-trace/20 disabled:opacity-40"
        >
          {loading ? "Validating…" : "Validate & open incident"}
        </button>
      </div>
    </Panel>
  );
}
