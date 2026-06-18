import { NextResponse } from "next/server";
import {
  generateCustomerId,
  listCrmCustomers,
  upsertCrmCustomer,
} from "@/lib/crm/store";
import { CrmCustomerSchema } from "@/lib/crm/types";

export async function GET() {
  return NextResponse.json({ ok: true, customers: listCrmCustomers() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CrmCustomerSchema.partial({ customer_id: true }).parse(body);

    const customer = upsertCrmCustomer({
      ...parsed,
      customer_id:
        parsed.customer_id ?? generateCustomerId(parsed.name ?? "customer"),
    });

    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid customer";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
