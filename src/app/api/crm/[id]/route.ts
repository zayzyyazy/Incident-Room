import { NextResponse } from "next/server";
import { deleteCrmCustomer, getCrmCustomer, upsertCrmCustomer } from "@/lib/crm/store";
import { CrmCustomerSchema } from "@/lib/crm/types";

type RouteParams = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteParams) {
  const customer = getCrmCustomer(params.id);
  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, customer });
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const parsed = CrmCustomerSchema.parse({
      ...body,
      customer_id: params.id,
    });
    const customer = upsertCrmCustomer(parsed);
    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid customer";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const deleted = deleteCrmCustomer(params.id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
