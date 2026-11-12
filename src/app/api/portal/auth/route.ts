import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookies, forwardToGateway } from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Prijava kupca: email i lozinka idu samo do Gastro Control gateway-a, tokeni ostaju u kolačićima. */
export async function POST(request: NextRequest) {
  let email = "";
  let password = "";
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    email = String(body.email ?? "").slice(0, 254);
    password = String(body.password ?? "").slice(0, 200);
  } catch {
    // prazno telo → gateway vraća poruku „Unesite email i lozinku.“
  }
  return forwardToGateway(request, { action: "login", email, password });
}

/** Odjava: brišu se kolačići ovog portala. */
export async function DELETE() {
  return clearSessionCookies(NextResponse.json({ success: true }));
}
