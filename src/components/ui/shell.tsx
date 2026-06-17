import Link from "next/link";
import { ReactNode } from "react";
import {
  IconIncidents,
  IconOverview,
  IconReports,
  IconSettings,
} from "@/components/ui/icons";

const DESK_NAV = [
  { href: "/", label: "Overview", icon: IconOverview },
  { href: "/", label: "Incidents", icon: IconIncidents },
  { href: "/guide", label: "Reports", icon: IconReports },
  { href: "/crm", label: "Settings", icon: IconSettings },
];

function DeskNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof IconOverview;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
        active
          ? "bg-trace/10 font-medium text-trace"
          : "text-room-muted hover:bg-room-elevated/60 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
  meta,
  actions,
  toolbar,
  variant = "desk",
  sidebar,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  meta?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  variant?: "desk" | "investigation";
  sidebar?: ReactNode;
}) {
  return (
    <div className="relative z-10 flex min-h-screen bg-room-bg">
      {sidebar}

      {variant === "desk" ? (
        <aside className="hidden w-56 shrink-0 border-r border-room-border bg-[#11141a] lg:flex lg:flex-col">
          <div className="border-b border-room-border px-4 py-5">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-trace font-mono text-xs font-bold text-room-bg">
                IR
              </div>
              <div className="text-sm font-semibold text-foreground">Incident Room</div>
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {DESK_NAV.map((item, i) => (
              <DeskNavLink
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={i < 2}
              />
            ))}
          </nav>
          <div className="border-t border-room-border p-3">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-room-muted hover:bg-room-elevated/60"
            >
              <span className="text-xs">‹</span> Collapse
            </button>
          </div>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-room-border bg-[#11141a]/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-4 lg:hidden">
              <Link
                href="/"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-trace font-mono text-xs font-bold text-room-bg"
              >
                IR
              </Link>
            </div>

            {variant === "investigation" ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-room-muted">
                    Voice incident investigation
                  </p>
                  {title ? (
                    <h1 className="mt-0.5 truncate text-base font-semibold text-foreground">
                      {title}
                    </h1>
                  ) : null}
                </div>
                <div className="hidden h-8 w-px bg-room-border sm:block" />
                <div className="text-xs text-room-muted">
                  {subtitle ? <span className="font-mono">{subtitle}</span> : null}
                  {meta ? <span className="ml-3">{meta}</span> : null}
                </div>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold text-foreground">
                  {title ?? "Operations Desk"}
                </h1>
                {subtitle ? (
                  <p className="mt-0.5 text-sm text-room-muted">{subtitle}</p>
                ) : null}
              </div>
            )}

            <div className="flex items-center gap-4">
              {actions}
              {toolbar}
              <nav className="hidden items-center gap-5 text-sm sm:flex">
                <Link href="/guide" className="text-room-muted hover:text-foreground">
                  Guide
                </Link>
                <Link href="/" className="text-room-muted hover:text-foreground">
                  Desk
                </Link>
                <Link href="/crm" className="text-room-muted hover:text-foreground">
                  CRM
                </Link>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-room-elevated text-[10px] font-bold text-room-muted">
                  SD
                </div>
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const label =
    status === "investigating"
      ? "Investigating"
      : status === "complete"
        ? "Complete"
        : status === "pending"
          ? "Pending"
          : status;

  const styles: Record<string, string> = {
    pending: "border-signal/40 text-signal bg-signal/10",
    investigating:
      "border-signal/70 text-signal bg-signal/20 shadow-[0_0_24px_rgba(232,149,74,0.2)]",
    complete: "border-trace/50 text-trace bg-trace/10",
    failed: "border-alert/50 text-alert bg-alert/10",
  };

  return (
    <span
      className={`rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${styles[status] ?? styles.pending}`}
    >
      {label}
    </span>
  );
}

export function Panel({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-room-border bg-room-panel ${className}`}>
      {title ? (
        <div className="flex items-center justify-between border-b border-room-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "signal" | "trace" | "command";
  icon?: ReactNode;
}) {
  const toneClass = {
    default: "text-foreground",
    signal: "text-signal",
    trace: "text-trace",
    command: "text-command",
  }[tone];

  const iconBg = {
    default: "bg-room-elevated text-room-muted",
    signal: "bg-signal/15 text-signal",
    trace: "bg-trace/15 text-trace",
    command: "bg-command/15 text-command",
  }[tone];

  return (
    <div className="rounded-xl border border-room-border bg-room-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-room-muted">{label}</p>
          <p className={`mt-2 text-3xl font-semibold tabular-nums ${toneClass}`}>
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-room-muted">{hint}</p> : null}
        </div>
        {icon ? (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  const label = platform.replace(/_/g, " ");
  return (
    <span className="text-sm capitalize text-foreground">{label}</span>
  );
}
