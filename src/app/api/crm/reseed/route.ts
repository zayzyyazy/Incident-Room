import { NextResponse } from "next/server";
import { reseedCrmFromFixtureForRuntime } from "@/lib/crm/store";

export async function POST() {
  try {
    const customers = await reseedCrmFromFixtureForRuntime();
    return NextResponse.json({ ok: true, customers, count: customers.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Reseed failed" },
      { status: 500 },
    );
  }
}
