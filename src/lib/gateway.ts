import "server-only";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

/**
 * Jedina veza servis portala sa Gastro Control-om: POST {GASTRO_CONTROL_URL}/api/portal-gateway.
 * Ovaj projekat nema ključ ni adresu baze. Tokeni kupca su samo u httpOnly kolačićima ovog portala.
 * Ugovor: docs/portal-gateway.md u repozitorijumu gastroopremacis.
 */

const ACCESS_COOKIE = "gs_access";
const REFRESH_COOKIE = "gs_refresh";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
const TIMEOUT_MS = 20_000;

type GatewaySession = { access: string; refresh: string; expires: number };
type GatewayBody = Record<string, unknown> & { session?: GatewaySession; code?: string; message?: string };

/** Tajna mora biti jedan red bez razmaka; vrednost se nikad ne ispisuje u logove. */
function secret(name: string, minLength: number): string | null {
  const value = (process.env[name] ?? "").trim();
  if (!value) return minLength === 0 ? "" : null;
  if (/\s/.test(value)) {
    console.error(`Servis portal: ${name} sadrži razmak ili prelom reda — upišite ga kao jedan red.`);
    return null;
  }
  if (value.length < minLength) {
    console.error(`Servis portal: ${name} je kraći od ${minLength} znakova.`);
    return null;
  }
  return value;
}

function config() {
  const url = (process.env.GASTRO_CONTROL_URL ?? "").trim().replace(/\/+$/, "");
  const key = secret("PORTAL_GATEWAY_KEY", 32);
  const bypass = secret("VERCEL_PROTECTION_BYPASS", 0);
  if (!/^https?:\/\//.test(url) || key === null || bypass === null) return null;
  return { url, key, bypass };
}

/** Opis greške bez sadržaja zahteva (zaglavlja mogu da nose tajne). */
function safeError(error: unknown) {
  if (error instanceof Error) return error.name === "TimeoutError" ? "isteklo vreme čekanja" : error.name;
  return "nepoznata greška";
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

function setSessionCookies(response: NextResponse, session: GatewaySession) {
  response.cookies.set(ACCESS_COOKIE, session.access, cookieOptions(session.expires));
  response.cookies.set(REFRESH_COOKIE, session.refresh, cookieOptions(REFRESH_MAX_AGE));
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
  return response;
}

/** IP adresa kupca kako je vidi ovaj portal (Vercel: prva adresa iz x-forwarded-for). */
function clientIp(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  return isIP(ip) ? ip : "";
}

const unavailable = () =>
  NextResponse.json({ success: false, message: "Servis portal trenutno nije dostupan. Pokušajte ponovo za nekoliko minuta." }, { status: 503 });

/**
 * Prosleđuje radnju kroz gateway i vraća odgovor pregledaču:
 * - nove ili osvežene tokene upisuje u kolačiće (nikad ih ne šalje u telo odgovora),
 * - istekla sesija kupca → 401 i brisanje kolačića (stranica vodi na prijavu),
 * - zaključan gateway / pogrešan ključ / mrežna greška → 503 (kupac nije kriv, ne vodi se na prijavu).
 */
export async function forwardToGateway(request: NextRequest, payload: Record<string, unknown>): Promise<NextResponse> {
  const cfg = config();
  if (!cfg) {
    console.error("Servis portal: GASTRO_CONTROL_URL, PORTAL_GATEWAY_KEY ili VERCEL_PROTECTION_BYPASS nije ispravno podešen.");
    return unavailable();
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${cfg.key}`,
  };
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (access) headers["x-portal-access"] = access;
  if (refresh) headers["x-portal-refresh"] = refresh;
  const ip = clientIp(request);
  if (ip) headers["x-portal-client-ip"] = ip;
  if (cfg.bypass) headers["x-vercel-protection-bypass"] = cfg.bypass;

  let status: number;
  let body: GatewayBody;
  try {
    const response = await fetch(`${cfg.url}/api/portal-gateway`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = response.status;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) {
      console.error(`Servis portal: gateway je vratio ${status} bez JSON-a (Vercel zaštita ili pogrešna adresa?).`);
      return unavailable();
    }
    body = (await response.json()) as GatewayBody;
  } catch (error) {
    console.error(`Servis portal: gateway nije dostupan (${safeError(error)}).`);
    return unavailable();
  }

  const { session, code, ...rest } = body;

  if (code === "GATEWAY_DISABLED" || code === "GATEWAY_DENIED" || code === "GATEWAY_ERROR" || code === "UNKNOWN_ACTION") {
    console.error(`Servis portal: gateway ${status} ${code}.`);
    return unavailable();
  }
  if (code === "SESSION_EXPIRED") return clearSessionCookies(NextResponse.json(rest, { status: 401 }));

  const response = NextResponse.json(rest, { status, headers: { "Cache-Control": "no-store" } });
  if (session?.access && session.refresh) setSessionCookies(response, session);
  return response;
}
