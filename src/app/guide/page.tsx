import Link from "next/link";
import { AppShell, Panel } from "@/components/ui/shell";
import {
  CAUSE_ROOM_AGENTS,
  LOCALIZATION_ROOM_AGENTS,
} from "@/lib/agents/registry";

const FLOW_STEPS = [
  {
    n: 1,
    title: "Import evidence",
    body: "Paste a VoiceIncidentEvidence bundle. The Normalizer splits transcript, tool trace, and workflow definition — no inference.",
    accent: "text-room-muted",
  },
  {
    n: 2,
    title: "Competing theories",
    body: "Claim Tracer and Backend Witness open with conflicting explanations. They challenge, counter, and withdraw until one survives.",
    accent: "text-trace",
  },
  {
    n: 3,
    title: "Cause + Architecture rooms",
    body: "Full pipeline runs Cause Room debate, then Architecture Room localization against your workflow graph. Cross-room challenges can force revision.",
    accent: "text-command",
  },
  {
    n: 4,
    title: "Audit memo",
    body: "Completed investigations produce a structured incident finding — customer impact, system reality, failed theories, and fix target.",
    accent: "text-signal",
  },
];

export default function GuidePage() {
  return (
    <AppShell
      title="How it works"
      subtitle="Voice CS incident investigation model"
      variant="desk"
    >
      <Panel title="Investigation flow" className="mb-6">
        <div className="grid gap-0 divide-y divide-room-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {FLOW_STEPS.map((step) => (
            <div key={step.n} className="p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-room-border bg-room-elevated font-mono text-xs font-bold text-trace">
                  {step.n}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${step.accent}`}>{step.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-room-muted">
                    {step.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel title="Access walls">
          <div className="space-y-4 p-5 text-sm leading-relaxed text-room-muted">
            <p>
              Agents only see evidence their role permits. The Normalizer routes packets —
              it does not judge.
            </p>
            <ul className="space-y-3">
              <li className="rounded-lg border border-trace/25 bg-trace/[0.04] px-4 py-3">
                <strong className="text-trace">Claim Tracer</strong> — transcript only
              </li>
              <li className="rounded-lg border border-signal/25 bg-signal/[0.04] px-4 py-3">
                <strong className="text-signal">Backend Witness</strong> — tool trace only
              </li>
              <li className="rounded-lg border border-command/25 bg-command/[0.04] px-4 py-3">
                <strong className="text-command">Architecture Room</strong> — workflow
                definition + Cause finding
              </li>
            </ul>
          </div>
        </Panel>

        <Panel title="What Localization needs">
          <div className="space-y-4 p-5 text-sm leading-relaxed text-room-muted">
            <p>
              Architecture Room cannot localize without your agent&apos;s{" "}
              <strong className="text-foreground">workflow definition</strong> — the same
              graph the production voice agent executes.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Register the source agent name under investigation.</li>
              <li>Store nodes, tool calls, and confirmation gates.</li>
              <li>Evidence bundle links Layer 1 transcript + Layer 2 execution log.</li>
            </ul>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Cause Room agents">
          <div className="divide-y divide-room-border">
            {CAUSE_ROOM_AGENTS.map((agent) => (
              <div key={agent.id} className="flex gap-4 px-5 py-3.5">
                <span
                  className={`font-mono text-xs font-bold ${agent.accentClass}`}
                >
                  {agent.shortLabel}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{agent.label}</p>
                  <p className="text-xs text-room-muted">{agent.layer}</p>
                  <p className="mt-1 text-xs text-room-muted">{agent.question}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Architecture Room agents">
          <div className="divide-y divide-room-border">
            {LOCALIZATION_ROOM_AGENTS.map((agent) => (
              <div key={agent.id} className="flex gap-4 px-5 py-3.5">
                <span
                  className={`font-mono text-xs font-bold ${agent.accentClass}`}
                >
                  {agent.shortLabel}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{agent.label}</p>
                  <p className="text-xs text-room-muted">{agent.layer}</p>
                  <p className="mt-1 text-xs text-room-muted">{agent.question}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Demo incidents" className="mt-6">
        <p className="border-b border-room-border px-5 py-3 text-xs text-room-muted">
          Seeded demos: Elena + Klaus. For Vapi, Retell, Bland, and other shapes use{" "}
          <strong className="text-foreground">Import evidence → Try platform samples</strong>{" "}
          on the desk.
        </p>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {[
            {
              id: "PMB-2026-0617-elena-pause-confusion",
              name: "Elena",
              path: "Earned investigation · pause/cancel confusion",
            },
            {
              id: "PMB-2024-0847",
              name: "Klaus",
              path: "Earned investigation · callback not created",
            },
          ].map((demo) => (
            <Link
              key={demo.id}
              href={`/incidents/${demo.id}`}
              className="rounded-xl border border-room-border bg-room-elevated p-4 transition hover:border-trace/40 hover:shadow-glow-trace"
            >
              <p className="font-semibold text-foreground">{demo.name}</p>
              <p className="font-mono text-[10px] text-room-muted">{demo.id}</p>
              <p className="mt-2 text-xs text-room-muted">{demo.path}</p>
            </Link>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
