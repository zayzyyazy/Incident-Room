import Link from "next/link";
import { AppShell, Panel } from "@/components/ui/shell";
import {
  CAUSE_ROOM_AGENTS,
  LOCALIZATION_ROOM_AGENTS,
} from "@/lib/agents/registry";

export default function GuidePage() {
  return (
    <AppShell title="How it works" subtitle="Two-room investigation model">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel title="The flow">
          <div className="space-y-4 p-4 text-sm leading-relaxed text-room-muted">
            <p>
              Each incident runs in <strong className="text-foreground">two Band rooms</strong>.
              Agents post thoughts, challenges, and artifacts — the UI streams each post as it
              lands in Band.
            </p>
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                <strong className="text-trace">Cause Room</strong> — Claim Tracer, Backend
                Witness, and Causal Judge debate what caused the customer belief vs execution
                mismatch. Output: <span className="text-foreground">CauseFinding</span>.
              </li>
              <li>
                <strong className="text-command">Localization Room</strong> — four investigators
                test that cause against your implementation graph. They can{" "}
                <span className="text-alert">throw cross-room challenges</span> back to Cause
                Room (DEFEND · REVISE · INSUFFICIENT).
              </li>
              <li>
                When both rooms agree (or honestly disagree), you get a{" "}
                <strong className="text-foreground">breakthrough</strong> and the exact{" "}
                <strong className="text-signal">surface</strong> in your workflow.
              </li>
            </ol>
          </div>
        </Panel>

        <Panel title="What you need for Localization">
          <div className="space-y-4 p-4 text-sm leading-relaxed text-room-muted">
            <p>
              Room 2 cannot localize without knowing{" "}
              <strong className="text-foreground">your agent&apos;s workflow</strong> — the
              same graph the production voice/chat agent executes.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Register the <strong className="text-foreground">source agent name</strong>{" "}
                (e.g. the Retell / Vapi / custom agent under investigation).
              </li>
              <li>
                Store its <strong className="text-foreground">workflow definition</strong>{" "}
                (nodes, tool calls, confirmation gates) so investigators can point at native
                surfaces.
              </li>
              <li>
                Evidence bundle links the incident to that agent — Layer 1 transcript + Layer 2
                execution log.
              </li>
            </ul>
            <p className="rounded-lg border border-signal/30 bg-signal/5 px-3 py-2 text-xs">
              Klaus demo ships with a pre-loaded Pflegemittelbox workflow graph. Marta and Stefan
              use the same pattern with different failure shapes.
            </p>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Cause Room agents">
          <div className="divide-y divide-room-border">
            {CAUSE_ROOM_AGENTS.map((agent) => (
              <div key={agent.id} className="flex gap-4 px-4 py-3">
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

        <Panel title="Localization Room agents">
          <div className="divide-y divide-room-border">
            {LOCALIZATION_ROOM_AGENTS.map((agent) => (
              <div key={agent.id} className="flex gap-4 px-4 py-3">
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
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {[
            {
              id: "PMB-2024-0847",
              name: "Klaus",
              path: "DEFEND → breakthrough at Anliegenaufnahme",
            },
            {
              id: "REV-2026-001",
              name: "Marta",
              path: "REVISE after tool unreachable",
            },
            {
              id: "SYN-2026-0615-stefan",
              name: "Stefan",
              path: "INSUFFICIENT — neither side fully proved",
            },
          ].map((demo) => (
            <Link
              key={demo.id}
              href={`/incidents/${demo.id}`}
              className="rounded-lg border border-room-border bg-room-elevated p-4 transition hover:border-trace/40"
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
