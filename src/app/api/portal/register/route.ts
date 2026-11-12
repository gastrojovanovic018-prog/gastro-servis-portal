import { NextRequest, NextResponse } from "next/server";
import { forwardToGateway } from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = [
  "registrant_type", "full_name", "email", "phone", "password", "company_name",
  "tax_id", "address", "city", "note", "consent", "website",
] as const;

/** Registracija: prosleđuju se samo poznata polja; provere i upis radi Gastro Control. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Neispravan zahtev." }, { status: 400 });
  }
  const payload: Record<string, unknown> = { action: "register" };
  for (const field of FIELDS) if (field in body) payload[field] = body[field];
  return forwardToGateway(request, payload);
}
