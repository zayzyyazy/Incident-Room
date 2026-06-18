import { NextResponse } from "next/server";
import { lookupCrmCustomer } from "@/lib/crm/lookup";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hints = {
    customer_id: searchParams.get("customer_id") ?? undefined,
    phone: searchParams.get("phone") ?? undefined,
    email: searchParams.get("email") ?? undefined,
    vnr_last4: searchParams.get("vnr_last4") ?? undefined,
    name: searchParams.get("name") ?? undefined,
  };

  const result = lookupCrmCustomer(hints);
  return NextResponse.json({ ok: true, ...result });
}
