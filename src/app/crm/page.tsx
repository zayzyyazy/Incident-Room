"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell, Panel } from "@/components/ui/shell";
import { CrmCustomer } from "@/lib/crm/types";

const emptyForm = {
  customer_id: "",
  name: "",
  phone: "",
  email: "",
  birth_date: "",
  address: "",
  vnr_last4: "",
  prior_calls_14d: "0",
  notes: "",
};

export default function CrmPage() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm");
      const data = await res.json();
      if (data.ok) {
        setCustomers(data.customers);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(customer: CrmCustomer) {
    setEditingId(customer.customer_id);
    setForm({
      customer_id: customer.customer_id,
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      birth_date: customer.birth_date ?? "",
      address: customer.address ?? "",
      vnr_last4: customer.vnr_last4 ?? "",
      prior_calls_14d: String(customer.prior_calls_14d ?? 0),
      notes: customer.notes ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      customer_id: form.customer_id || undefined,
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      birth_date: form.birth_date || undefined,
      address: form.address || undefined,
      vnr_last4: form.vnr_last4 || undefined,
      prior_calls_14d: Number(form.prior_calls_14d) || 0,
      notes: form.notes || undefined,
    };

    try {
      const url = editingId ? `/api/crm/${editingId}` : "/api/crm";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customerId: string) {
    if (!confirm("Delete this customer?")) {
      return;
    }
    await fetch(`/api/crm/${customerId}`, { method: "DELETE" });
    if (editingId === customerId) {
      resetForm();
    }
    await load();
  }

  return (
    <AppShell title="Fake CRM" subtitle="Customer records for agent lookup">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Panel title={editingId ? "Edit customer" : "Add customer"}>
          <form onSubmit={handleSubmit} className="space-y-3 p-4">
            <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+491701234567" />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Birth date" value={form.birth_date} onChange={(v) => setForm({ ...form, birth_date: v })} placeholder="YYYY-MM-DD" />
            <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <Field label="Insurance / VNR last 4" value={form.vnr_last4} onChange={(v) => setForm({ ...form, vnr_last4: v })} />
            <Field label="Prior calls (14d)" value={form.prior_calls_14d} onChange={(v) => setForm({ ...form, prior_calls_14d: v })} />
            <label className="block text-[11px] uppercase tracking-wider text-room-muted">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 h-20 w-full rounded-lg border border-room-border bg-room-bg p-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-trace/30"
              />
            </label>
            {editingId ? (
              <p className="font-mono text-[10px] text-room-muted">ID: {editingId}</p>
            ) : null}
            {error ? <p className="text-xs text-alert">{error}</p> : null}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="rounded-lg border border-trace/40 bg-trace/10 px-4 py-2 text-sm font-medium text-trace hover:bg-trace/20 disabled:opacity-40"
              >
                {saving ? "Saving…" : editingId ? "Update" : "Add customer"}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="rounded-lg border border-room-border px-4 py-2 text-sm text-room-muted">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </Panel>

        <Panel title={`Customers (${customers.length})`}>
          <div className="max-h-[640px] overflow-y-auto p-4">
            {loading ? (
              <p className="text-sm text-room-muted">Loading…</p>
            ) : customers.length === 0 ? (
              <p className="text-sm text-room-muted">No customers yet. Add one on the left.</p>
            ) : (
              <ul className="space-y-3">
                {customers.map((c) => (
                  <li key={c.customer_id} className="rounded-lg border border-room-border bg-room-bg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="font-mono text-[10px] text-room-muted">{c.customer_id}</div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(c)} className="text-xs text-trace hover:underline">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(c.customer_id)} className="text-xs text-alert hover:underline">
                          Delete
                        </button>
                      </div>
                    </div>
                    <dl className="mt-2 grid gap-1 text-xs text-room-muted">
                      {c.phone ? <div>📞 {c.phone}</div> : null}
                      {c.email ? <div>✉️ {c.email}</div> : null}
                      {c.birth_date ? <div>🎂 {c.birth_date}</div> : null}
                      {c.address ? <div>📍 {c.address}</div> : null}
                      {c.vnr_last4 ? <div>VNR ···{c.vnr_last4}</div> : null}
                      {c.notes ? <div className="italic">{c.notes}</div> : null}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-[11px] uppercase tracking-wider text-room-muted">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-room-border bg-room-bg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-trace/30"
      />
    </label>
  );
}
