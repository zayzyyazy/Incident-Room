export function IconOverview({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconIncidents({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 2.5h10v11H3z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconReports({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 12V6l5-3.5L13 6v6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.5 12V9.5h3V12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconSettings({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M3.2 12.8l1.3-1.3M11.5 4.5l1.3-1.3"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function IconSearch({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.2 10.2L14 14" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconChevronLeft({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
