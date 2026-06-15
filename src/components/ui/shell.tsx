import Link from "next/link";
import { ReactNode } from "react";

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="relative z-10 min-h-screen">
      <header className="border-b border-room-border bg-room-panel/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-trace/30 bg-room-elevated font-mono text-xs text-trace shadow-glow-trace">
                IR
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide text-foreground">
                  Incident Room
                </div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-room-muted">
                  Voice incident investigation
                </div>
              </div>
            </Link>
            {subtitle ? (
              <>
                <span className="text-room-border">/</span>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-xs text-room-muted">{subtitle}</div>
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {actions}
            <nav className="flex items-center gap-4 text-xs">
              <Link href="/guide" className="text-room-muted hover:text-trace">
                Guide
              </Link>
              <Link href="/" className="text-room-muted hover:text-trace">
                Desk
              </Link>
              <Link href="/crm" className="text-room-muted hover:text-trace">
                CRM
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border-room-border text-room-muted bg-room-elevated",
    investigating: "border-signal/50 text-signal bg-signal/10 animate-pulse-ring",
    complete: "border-trace/50 text-trace bg-trace/10",
    failed: "border-alert/50 text-alert bg-alert/10",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${styles[status] ?? styles.pending}`}
    >
      {status}
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
    <section
      className={`rounded-xl border border-room-border bg-room-panel ${className}`}
    >
      {title ? (
        <div className="flex items-center justify-between border-b border-room-border px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-room-muted">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
