import { NextRequest, NextResponse } from "next/server";
import { forwardToGateway } from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ_TYPES = new Set(["context", "equipment", "card", "history", "detail", "resolve"]);

const CREATE_FIELDS = [
  "equipment_unit_id", "partner_branch_id", "equipment_name", "model", "serial_number",
  "intervention_address", "reported_fault", "contact_name", "contact_phone", "contact_email",
] as const;

/** Čitanje podataka prijavljenog kupca (isti oblik kao /api/portal/data u Gastro Control-u). */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const type = query.get("type") ?? "";
  if (!READ_TYPES.has(type)) {
    return NextResponse.json({ success: false, message: "Nepoznata portal akcija." }, { status: 400 });
  }
  return forwardToGateway(request, {
    action: "read",
    type,
    params: { limit: query.get("limit"), offset: query.get("offset"), id: query.get("id"), code: query.get("code") },
  });
}

/** Novi zahtev za servis. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Neispravan zahtev." }, { status: 400 });
  }
  if (body.action !== "create_service_request") {
    return NextResponse.json({ success: false, message: "Nepoznata portal akcija." }, { status: 400 });
  }
  const payload: Record<string, unknown> = { action: "create_service_request" };
  for (const field of CREATE_FIELDS) if (field in body) payload[field] = body[field];
  return forwardToGateway(request, payload);
}
