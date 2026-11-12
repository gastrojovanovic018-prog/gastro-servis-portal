"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { clearAllWindowDrafts, useWindowState } from "@/lib/formDraft";
import { useUnsavedChanges } from "@/lib/formDraft";
import { useRouter } from "next/navigation";
import styles from "./portal.module.css";

type Equipment = {
  equipment_unit_id: number;
  sku?: string | null;
  name?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  serial_number?: string | null;
  location?: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  service_status?: string | null;
  go_id?: string | null;
  installation_date?: string | null;
  warranty_end_date?: string | null;
  delivery_document_number?: string | null;
  delivery_date?: string | null;
  service_count?: number;
  last_service_at?: string | null;
  open_request?: boolean;
};

type PartnerCard = {
  partner: {
    name: string;
    partner_code: string | null;
    tax_id: string | null;
    registration_number: string | null;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
  };
  branch_restricted: boolean;
  branches: Array<{ name: string; address: string | null; postal_code: string | null; city: string | null; is_headquarters: boolean }>;
  summary: { total: number; open: number; finished: number; equipment: number };
  billed_totals: Array<{ currency: string | null; gross_total: number }>;
  billed: Array<{ request_number: number; work_order_number: number; billed_at: string | null; invoice_number: string | null; invoice_date: string | null; currency: string | null; gross_total: number }>;
};

type Branch = { id: number; name: string; address: string | null; city: string | null };

type PortalContext = {
  partner_name: string | null;
  branch_restricted: boolean;
  branches: Branch[];
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  default_address: string | null;
};

type HistoryRow = {
  service_request_id: number;
  request_number: number;
  work_order_number: number | null;
  requested_at: string;
  equipment_name: string | null;
  model: string | null;
  serial_number: string | null;
  intervention_address: string | null;
  reported_fault: string | null;
  request_status: string;
  work_order_status: string | null;
  completed_at: string | null;
  closed_at: string | null;
};

type DetailItem = {
  line_type: string;
  name: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
};

type RequestDetail = {
  request: {
    service_request_id: number;
    request_number: number;
    requested_at: string;
    status: string;
    reported_fault: string | null;
    equipment_name: string | null;
    model: string | null;
    serial_number: string | null;
    intervention_address: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    rejection_reason: string | null;
  };
  work_order: {
    work_order_number: number;
    status: string;
    opened_at: string | null;
    assigned_at: string | null;
    technician_first_name: string | null;
    completed_at: string | null;
    closed_at: string | null;
  } | null;
  visits: Array<{ visit_number: number; status: string; scheduled_at: string | null; arrived_at: string | null; work_finished_at: string | null }>;
  reports: Array<{
    visit_number: number | null;
    diagnosed_fault: string | null;
    diagnosed_cause: string | null;
    work_performed: string | null;
    recommendation: string | null;
    machine_status: string | null;
    completed_at: string | null;
    media: ReportMedia[];
    handover: {
      customer_present: boolean | null;
      receiver_full_name: string | null;
      receiver_position: string | null;
      absence_reason: string | null;
      received_at: string | null;
      signature: { attachment_id: number; mime_type: string | null; url: string } | null;
    } | null;
  }>;
  calculation:
    | { state: "ZAVRSEN"; billing_mode: string; currency: string | null; items: DetailItem[]; net_total: number; vat_total: number; gross_total: number; invoice_number: string | null; invoice_date: string | null }
    | { state: "BEZ_NAPLATE"; billing_mode: string }
    | { state: "U_PRIPREMI" }
    | null;
};

type ReportMedia = { attachment_id: number; attachment_type: string; mime_type: string | null; captured_at: string | null; url: string };

const MEDIA_LABEL: Record<string, string> = {
  BEFORE_PHOTO: "Pre servisa",
  BEFORE_VIDEO: "Pre servisa",
  SERVICE_PHOTO: "Tokom servisa",
  SERVICE_VIDEO: "Tokom servisa",
  PART_PHOTO: "Rezervni deo",
  AFTER_PHOTO: "Posle servisa",
  AFTER_VIDEO: "Posle servisa",
  EQUIPMENT_ID_PHOTO: "Pločica uređaja",
};

/**
 * Potpis je providni PNG sa tankom tamnom linijom. Iscrtava se na belu podlogu
 * u samoj slici (tamni režim pregledača ne može da je zatamni), prazne ivice se
 * odsecaju, a linija podebljava da bi potpis bio jasno čitljiv.
 */
function SignatureImage({ url }: { url: string }) {
  const [rendered, setRendered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const source = new Image();
    source.crossOrigin = "anonymous";
    source.onload = () => {
      try {
        const width = source.naturalWidth;
        const height = source.naturalHeight;
        const probe = document.createElement("canvas");
        probe.width = width;
        probe.height = height;
        const probeCtx = probe.getContext("2d", { willReadFrequently: true });
        if (!probeCtx) return;
        probeCtx.drawImage(source, 0, 0);
        const pixels = probeCtx.getImageData(0, 0, width, height).data;

        let minX = width, minY = height, maxX = -1, maxY = -1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            const ink = pixels[i + 3] > 40 && pixels[i] + pixels[i + 1] + pixels[i + 2] < 600;
            if (ink) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) return;

        const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.08) + 8;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(width, maxX + pad) - cropX;
        const cropH = Math.min(height, maxY + pad) - cropY;

        const out = document.createElement("canvas");
        out.width = cropW;
        out.height = cropH;
        const ctx = out.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cropW, cropH);

        // Linija se podebljava crtanjem iste slike sa malim pomacima.
        const stroke = Math.max(1, Math.round(Math.max(cropW, cropH) / 300));
        for (let dx = -stroke; dx <= stroke; dx += 1) {
          for (let dy = -stroke; dy <= stroke; dy += 1) {
            if (dx * dx + dy * dy > stroke * stroke) continue;
            ctx.drawImage(source, cropX, cropY, cropW, cropH, dx, dy, cropW, cropH);
          }
        }

        if (!cancelled) setRendered(out.toDataURL("image/png"));
      } catch {
        // Ako skladište ne dozvoli obradu slike, prikazuje se original.
      }
    };
    source.src = url;
    return () => { cancelled = true; };
  }, [url]);

  return <img className={styles.signatureImage} src={rendered ?? url} alt="Potpis primaoca" />;
}

function isVideoMedia(item: ReportMedia) {
  return item.attachment_type.endsWith("_VIDEO") || (item.mime_type ?? "").startsWith("video/");
}

const MACHINE_STATUS: Record<string, string> = {
  OPERATIONAL: "Ispravan, radi",
  PARTIALLY_OPERATIONAL: "Radi delimično",
  NOT_OPERATIONAL: "Ne radi",
  WAITING_PART: "Čeka rezervni deo",
  WAITING_APPROVAL: "Čeka vašu saglasnost",
  FOLLOW_UP_REQUIRED: "Potrebna nova poseta",
};

const VISIT_STATUS: Record<string, string> = {
  PLANNED: "Zakazana",
  ARRIVED: "Serviser stigao",
  DIAGNOSIS: "Dijagnostika",
  WORKING: "U radu",
  PAUSED: "Pauzirana",
  FINISHED: "Završena",
};

function money(value: number, currency: string | null) {
  const amount = Number(value || 0).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${amount} ${currency}` : amount;
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

type Tab = "prijava" | "zahtevi" | "uredjaji" | "kartica";
type DeviceMode = "evidencija" | "rucno";
type Tone = "done" | "wait" | "stop" | "info";

/** Prikaz statusa za klijenta (poslovni status ostaje u bazi). */
function clientStatus(row: { work_order_status: string | null; request_status: string }): { label: string; tone: Tone } {
  switch (row.work_order_status) {
    case "OPEN": return { label: "Odobren", tone: "info" };
    case "ASSIGNED": return { label: "Serviser dodeljen", tone: "info" };
    case "IN_PROGRESS": return { label: "U radu", tone: "info" };
    case "WAITING_PART": return { label: "Čeka rezervni deo", tone: "wait" };
    case "WAITING_CUSTOMER_APPROVAL": return { label: "Čeka vašu saglasnost", tone: "wait" };
    case "COMPLETED":
    case "CONTROL": return { label: "Završen, u kontroli", tone: "done" };
    case "CLOSED":
    case "INVOICED": return { label: "Završen", tone: "done" };
    case "CANCELLED": return { label: "Otkazan", tone: "stop" };
  }
  switch (row.request_status) {
    case "NEW":
    case "WAITING_APPROVAL": return { label: "Primljen, čeka pregled", tone: "wait" };
    case "APPROVED": return { label: "Odobren", tone: "info" };
    case "REJECTED": return { label: "Odbijen", tone: "stop" };
    case "CANCELLED": return { label: "Otkazan", tone: "stop" };
  }
  return { label: row.request_status, tone: "info" };
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function branchAddress(branch: Branch | undefined) {
  if (!branch) return "";
  return [branch.address, branch.city].filter(Boolean).join(", ");
}

export default function PortalPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("prijava");
  const [context, setContext] = useState<PortalContext | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [card, setCard] = useState<PartnerCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Prijava kvara se pamti dok je prozor otvoren (i posle F5).
  const [deviceMode, setDeviceMode, formDraft] = useWindowState<DeviceMode>("portal.deviceMode", "rucno");
  const [selectedId, setSelectedId] = useWindowState<number | null>("portal.selectedId", null);
  const [lookup, setLookup] = useWindowState("portal.lookup", "");
  const [equipmentName, setEquipmentName] = useWindowState("portal.equipmentName", "");
  const [model, setModel] = useWindowState("portal.model", "");
  const [serial, setSerial] = useWindowState("portal.serial", "");
  const [branchId, setBranchId] = useWindowState("portal.branchId", "");
  const [address, setAddress] = useWindowState("portal.address", "");
  const [fault, setFault] = useWindowState("portal.fault", "");
  const [contactName, setContactName] = useWindowState("portal.contactName", "");
  const [contactPhone, setContactPhone] = useWindowState("portal.contactPhone", "");
  const [contactEmail, setContactEmail] = useWindowState("portal.contactEmail", "");

  const selected = useMemo(
    () => equipment.find((item) => item.equipment_unit_id === selectedId) ?? null,
    [equipment, selectedId]
  );

  const api = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    if (response.status === 401) {
      router.replace("/login");
      throw new Error("AUTH");
    }
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.message ?? "Greška.");
    return payload;
  }, [router]);

  const loadHistory = useCallback(async () => {
    try {
      const result = await api("/api/portal/data?type=history&limit=50");
      setHistory(result.rows ?? []);
      setHistoryLoaded(true);
    } catch (e) {
      if ((e as Error).message !== "AUTH") setError((e as Error).message);
    }
  }, [api]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    setError("");
    try {
      const result = await api(`/api/portal/data?type=detail&id=${id}`);
      setDetail(result as RequestDetail);
      window.scrollTo({ top: 0 });
    } catch (e) {
      if ((e as Error).message !== "AUTH") setError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [ctx, eq] = await Promise.all([
          api("/api/portal/data?type=context"),
          api("/api/portal/data?type=equipment"),
        ]);
        if (!active) return;
        const nextContext = ctx as PortalContext;
        setContext(nextContext);
        setEquipment(eq.rows ?? []);
        // Vraćen nacrt prijave (posle F5) se ne prepisuje podacima sa servera.
        if (formDraft.restored) return;
        setDeviceMode((eq.rows ?? []).length > 0 ? "evidencija" : "rucno");
        setContactName(nextContext.contact_name ?? "");
        setContactPhone(nextContext.contact_phone ?? "");
        setContactEmail(nextContext.contact_email ?? "");
        const firstBranch = nextContext.branches[0];
        if (nextContext.branches.length === 1 && firstBranch) {
          setBranchId(String(firstBranch.id));
          setAddress(branchAddress(firstBranch) || nextContext.default_address || "");
        } else {
          setAddress(nextContext.default_address ?? "");
        }
      } catch (e) {
        if (active && (e as Error).message !== "AUTH") setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [api]);

  function chooseTab(next: Tab) {
    setTab(next);
    setDetail(null);
    setMessage("");
    setError("");
    if (next === "zahtevi") void loadHistory();
    if (next === "kartica" && !card) {
      void api("/api/portal/data?type=card")
        .then((result) => setCard(result as PartnerCard))
        .catch((e: Error) => { if (e.message !== "AUTH") setError(e.message); });
    }
  }

  function chooseBranch(value: string) {
    setBranchId(value);
    const branch = context?.branches.find((item) => String(item.id) === value);
    setAddress(branchAddress(branch) || context?.default_address || "");
  }

  async function resolveCode() {
    if (!lookup.trim()) return;
    setMessage("");
    setError("");
    try {
      const result = await api("/api/portal/data?type=resolve&code=" + encodeURIComponent(lookup.trim()));
      if (!result.found) {
        setError(result.message ?? "Uređaj nije pronađen.");
        return;
      }
      setSelectedId(result.equipment_unit_id);
      if (!equipment.some((item) => item.equipment_unit_id === result.equipment_unit_id)) {
        setEquipment((current) => [...current, result as Equipment]);
      }
      setMessage("Uređaj je pronađen i izabran.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function validate() {
    if (deviceMode === "evidencija" && !selectedId) return "Izaberite uređaj ili izaberite „Uređaj nije na listi“.";
    if (deviceMode === "rucno") {
      if (equipmentName.trim().length < 2) return "Upišite naziv uređaja.";
      if (address.trim().length < 3) return "Upišite adresu na kojoj je uređaj.";
    }
    if (fault.trim().length < 3) return "Opišite kvar.";
    if (contactName.trim().length < 2) return "Upišite kontakt osobu.";
    if (contactPhone.replace(/\D/g, "").length < 6) return "Upišite telefon za kontakt.";
    return "";
  }

  async function createRequest() {
    const problem = validate();
    if (problem) {
      setError(problem);
      setMessage("");
      return;
    }

    setSending(true);
    setMessage("");
    setError("");
    try {
      const manual = deviceMode === "rucno";
      const result = await api("/api/portal/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_service_request",
          equipment_unit_id: manual ? null : selectedId,
          partner_branch_id: manual && branchId ? Number(branchId) : null,
          equipment_name: manual ? equipmentName.trim() : null,
          model: manual ? model.trim() : null,
          serial_number: manual ? serial.trim() : null,
          intervention_address: manual ? address.trim() : null,
          reported_fault: fault.trim(),
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          contact_email: contactEmail.trim(),
        }),
      });

      setMessage(`Zahtev SZ-${result.request_number} je poslat. Status pratite u kartici „Moji zahtevi“.`);
      setFault("");
      setLookup("");
      setSelectedId(null);
      setEquipmentName("");
      setModel("");
      setSerial("");
      setHistoryLoaded(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    await fetch("/api/portal/auth", { method: "DELETE" });
    // Odjava briše nacrte prijave.
    clearAllWindowDrafts();
    router.replace("/login");
  }

  const branches = context?.branches ?? [];
  // Nesnimljena prijava kvara: uneti podaci o uređaju ili opis kvara.
  const dirty = Boolean(fault.trim() || lookup.trim() || equipmentName.trim() || model.trim() || serial.trim() || selectedId !== null);
  useUnsavedChanges(dirty);
  const showBranchSelect = deviceMode === "rucno" && branches.length > 1;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.brand}>Gastro Oprema · servisni portal</div>
            <h1 className={styles.title}>{context?.partner_name || "Servisni portal"}</h1>
          </div>
          <button type="button" onClick={() => void logout()} className={styles.buttonSecondary}>ODJAVI SE</button>
        </header>

        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === "prijava"} className={`${styles.tab} ${tab === "prijava" ? styles.tabActive : ""}`} onClick={() => chooseTab("prijava")}>
            PRIJAVA SERVISA
          </button>
          <button type="button" role="tab" aria-selected={tab === "zahtevi"} className={`${styles.tab} ${tab === "zahtevi" ? styles.tabActive : ""}`} onClick={() => chooseTab("zahtevi")}>
            MOJI ZAHTEVI
          </button>
          <button type="button" role="tab" aria-selected={tab === "uredjaji"} className={`${styles.tab} ${tab === "uredjaji" ? styles.tabActive : ""}`} onClick={() => chooseTab("uredjaji")}>
            MOJI UREĐAJI
          </button>
          <button type="button" role="tab" aria-selected={tab === "kartica"} className={`${styles.tab} ${tab === "kartica" ? styles.tabActive : ""}`} onClick={() => chooseTab("kartica")}>
            MOJA KARTICA
          </button>
        </div>

        {message && <div className={styles.success}>{message}</div>}
        {error && <div className={styles.error}>{error}</div>}

        {tab === "prijava" ? (
          <section className={styles.panel}>
            {loading ? (
              <div className={styles.muted}>Učitavanje...</div>
            ) : (
              <>
                <div className={styles.section}>
                  <h2 className={styles.panelTitle}>Uređaj</h2>
                  {equipment.length > 0 && (
                    <div className={styles.segmented} style={{ marginBottom: 12 }}>
                      <button type="button" className={`${styles.segment} ${deviceMode === "evidencija" ? styles.segmentActive : ""}`} onClick={() => { setDeviceMode("evidencija"); setError(""); }}>
                        MOJI UREĐAJI
                      </button>
                      <button type="button" className={`${styles.segment} ${deviceMode === "rucno" ? styles.segmentActive : ""}`} onClick={() => { setDeviceMode("rucno"); setError(""); }}>
                        UREĐAJ NIJE NA LISTI
                      </button>
                    </div>
                  )}

                  {deviceMode === "evidencija" ? (
                    <div className={styles.stack}>
                      <div className={styles.lookupRow}>
                        <input className={styles.input} value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="QR, serijski ili servisni broj" />
                        <button type="button" onClick={() => void resolveCode()} className={styles.buttonSecondary}>PRONAĐI</button>
                      </div>
                      <div className={styles.deviceList}>
                        {equipment.map((item) => (
                          <button
                            type="button"
                            key={item.equipment_unit_id}
                            onClick={() => setSelectedId(item.equipment_unit_id)}
                            className={`${styles.deviceCard} ${selectedId === item.equipment_unit_id ? styles.deviceCardSelected : ""}`}
                            aria-pressed={selectedId === item.equipment_unit_id}
                          >
                            <div className={styles.cardName}>{item.name || "Uređaj"}{item.model ? ` · ${item.model}` : ""}</div>
                            <div className={styles.cardMeta}>SN: {item.serial_number || "—"} · {item.location || "Lokacija nije upisana"}</div>
                            <div className={styles.cardMeta}><span className={styles.badge}>{item.service_status || "VAN GARANCIJE"}</span></div>
                          </button>
                        ))}
                      </div>
                      {selected && <div className={styles.muted}>Izabrano: <strong>{selected.name || "Uređaj"} {selected.model || ""}</strong></div>}
                    </div>
                  ) : (
                    <div className={styles.grid3}>
                      <label className={styles.label}>
                        Naziv uređaja *
                        <input className={styles.input} value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} placeholder="npr. konvektomat Unox, mašina za pranje posuđa Lamber" />
                      </label>
                      <label className={styles.label}>
                        Model
                        <input className={styles.input} value={model} onChange={(e) => setModel(e.target.value)} />
                      </label>
                      <label className={styles.label}>
                        Serijski broj
                        <input className={styles.input} value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="sa nalepnice, ako postoji" />
                      </label>
                    </div>
                  )}
                </div>

                {deviceMode === "rucno" && (
                  <div className={styles.section}>
                    <h2 className={styles.panelTitle}>Lokacija</h2>
                    <div className={styles.grid2}>
                      {showBranchSelect && (
                        <label className={styles.label}>
                          Objekat / filijala
                          <select className={styles.select} value={branchId} onChange={(e) => chooseBranch(e.target.value)} disabled={context?.branch_restricted}>
                            <option value="">— izaberite —</option>
                            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                          </select>
                        </label>
                      )}
                      <label className={`${styles.label} ${showBranchSelect ? "" : styles.full}`}>
                        Adresa na kojoj je uređaj *
                        <input className={styles.input} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
                      </label>
                    </div>
                  </div>
                )}

                <div className={styles.section}>
                  <h2 className={styles.panelTitle}>Opis kvara</h2>
                  <textarea className={styles.textarea} value={fault} onChange={(e) => setFault(e.target.value)} placeholder="Šta se dešava, od kada, da li se pojavljuje greška na displeju..." />
                </div>

                <div className={styles.section}>
                  <h2 className={styles.panelTitle}>Kontakt za servisera</h2>
                  <div className={styles.grid3}>
                    <label className={styles.label}>
                      Kontakt osoba *
                      <input className={styles.input} value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="name" />
                    </label>
                    <label className={styles.label}>
                      Telefon *
                      <input className={styles.input} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} type="tel" autoComplete="tel" />
                    </label>
                    <label className={styles.label}>
                      Email
                      <input className={styles.input} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" autoComplete="email" />
                    </label>
                  </div>
                </div>

                <div className={styles.section}>
                  <button type="button" onClick={() => void createRequest()} disabled={sending} className={styles.button}>
                    {sending ? "SLANJE..." : "POŠALJI ZAHTEV ZA SERVIS"}
                  </button>
                </div>
              </>
            )}
          </section>
        ) : tab === "uredjaji" ? (
          <EquipmentView
            equipment={equipment}
            loading={loading}
            onReport={(id) => {
              setDeviceMode("evidencija");
              setSelectedId(id);
              setTab("prijava");
              setMessage("");
              setError("");
              window.scrollTo({ top: 0 });
            }}
          />
        ) : tab === "kartica" ? (
          <PartnerCardView card={card} />
        ) : detail ? (
          <RequestDetailView detail={detail} onBack={() => setDetail(null)} />
        ) : (
          <section className={styles.panel}>
            <div className={styles.requestHead} style={{ marginBottom: 12 }}>
              <h2 className={styles.panelTitle} style={{ margin: 0 }}>Moji zahtevi</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => void loadHistory()}>OSVEŽI</button>
            </div>
            {!historyLoaded ? (
              <div className={styles.muted}>Učitavanje...</div>
            ) : history.length === 0 ? (
              <div className={styles.emptyBox}>Još nema prijavljenih servisa.</div>
            ) : (
              <div className={styles.stack}>
                {history.map((row) => {
                  const status = clientStatus(row);
                  const toneClass = status.tone === "done" ? styles.badgeDone : status.tone === "wait" ? styles.badgeWait : status.tone === "stop" ? styles.badgeStop : "";
                  return (
                    <button
                      type="button"
                      key={row.service_request_id}
                      className={`${styles.requestCard} ${styles.requestCardButton}`}
                      onClick={() => void openDetail(row.service_request_id)}
                      disabled={detailLoading}
                    >
                      <div className={styles.requestHead}>
                        <div>
                          <div className={styles.cardName}>
                            SZ-{row.request_number}{row.work_order_number ? ` · RN ${row.work_order_number}` : ""}
                          </div>
                          <div className={styles.cardMeta}>Prijavljeno {formatDate(row.requested_at)}</div>
                        </div>
                        <span className={`${styles.badge} ${toneClass}`}>{status.label}</span>
                      </div>
                      <div className={styles.cardMeta}>
                        {[row.equipment_name, row.model, row.serial_number ? `SN ${row.serial_number}` : null].filter(Boolean).join(" · ") || "Uređaj"}
                      </div>
                      {row.intervention_address && <div className={styles.cardMeta}>{row.intervention_address}</div>}
                      {row.reported_fault && <div className={styles.cardMeta}>Kvar: {row.reported_fault}</div>}
                      {(row.closed_at || row.completed_at) && (
                        <div className={styles.cardMeta}>Završeno {formatDate(row.closed_at || row.completed_at)}</div>
                      )}
                      <div className={styles.cardLink}>Detalji, izveštaj i obračun →</div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function RequestDetailView({ detail, onBack }: { detail: RequestDetail; onBack: () => void }) {
  const { request, work_order: wo, visits, reports, calculation } = detail;
  const status = clientStatus({ work_order_status: wo?.status ?? null, request_status: request.status });
  const toneClass = status.tone === "done" ? styles.badgeDone : status.tone === "wait" ? styles.badgeWait : status.tone === "stop" ? styles.badgeStop : "";

  return (
    <section className={styles.panel}>
      <div className={styles.requestHead}>
        <div>
          <div className={styles.cardName}>SZ-{request.request_number}{wo ? ` · RN ${wo.work_order_number}` : ""}</div>
          <div className={styles.cardMeta}>Prijavljeno {formatDateTime(request.requested_at)}</div>
        </div>
        <span className={`${styles.badge} ${toneClass}`}>{status.label}</span>
      </div>

      <div className={styles.section}>
        <h2 className={styles.panelTitle}>Prijava</h2>
        <dl className={styles.facts}>
          <dt>Uređaj</dt><dd>{[request.equipment_name, request.model, request.serial_number ? `SN ${request.serial_number}` : null].filter(Boolean).join(" · ") || "—"}</dd>
          <dt>Adresa</dt><dd>{request.intervention_address || "—"}</dd>
          <dt>Kvar</dt><dd>{request.reported_fault || "—"}</dd>
          <dt>Kontakt</dt><dd>{[request.contact_name, request.contact_phone].filter(Boolean).join(" · ") || "—"}</dd>
          {request.rejection_reason && <><dt>Razlog odbijanja</dt><dd>{request.rejection_reason}</dd></>}
        </dl>
      </div>

      {wo && (
        <div className={styles.section}>
          <h2 className={styles.panelTitle}>Radni nalog</h2>
          <dl className={styles.facts}>
            <dt>Broj</dt><dd>RN {wo.work_order_number}</dd>
            <dt>Status</dt><dd>{status.label}</dd>
            {wo.technician_first_name && <><dt>Serviser</dt><dd>{wo.technician_first_name}</dd></>}
            {wo.opened_at && <><dt>Otvoren</dt><dd>{formatDateTime(wo.opened_at)}</dd></>}
            {(wo.closed_at || wo.completed_at) && <><dt>Završen</dt><dd>{formatDateTime(wo.closed_at || wo.completed_at)}</dd></>}
          </dl>
          {visits.length > 0 && (
            <div className={styles.stack} style={{ marginTop: 12 }}>
              {visits.map((visit) => (
                <div key={visit.visit_number} className={styles.requestCard}>
                  <div className={styles.cardName}>Poseta {visit.visit_number} · {VISIT_STATUS[visit.status] ?? visit.status}</div>
                  <div className={styles.cardMeta}>
                    {[
                      visit.scheduled_at ? `Zakazano ${formatDateTime(visit.scheduled_at)}` : null,
                      visit.arrived_at ? `Dolazak ${formatDateTime(visit.arrived_at)}` : null,
                      visit.work_finished_at ? `Završeno ${formatDateTime(visit.work_finished_at)}` : null,
                    ].filter(Boolean).join(" · ") || "Termin još nije zakazan"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {reports.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.panelTitle}>Izveštaj servisera</h2>
          {reports.map((report, index) => (
            <div key={index} className={styles.reportBlock}>
              {reports.length > 1 && report.visit_number != null && <div className={styles.cardName}>Poseta {report.visit_number}</div>}
              <dl className={styles.facts}>
                {report.machine_status && <><dt>Stanje uređaja</dt><dd>{MACHINE_STATUS[report.machine_status] ?? report.machine_status}</dd></>}
                {report.diagnosed_fault && <><dt>Utvrđen kvar</dt><dd>{report.diagnosed_fault}</dd></>}
                {report.diagnosed_cause && <><dt>Uzrok</dt><dd>{report.diagnosed_cause}</dd></>}
                {report.work_performed && <><dt>Urađeno</dt><dd>{report.work_performed}</dd></>}
                {report.recommendation && <><dt>Preporuka</dt><dd>{report.recommendation}</dd></>}
                {report.completed_at && <><dt>Datum</dt><dd>{formatDateTime(report.completed_at)}</dd></>}
              </dl>

              {report.media.length > 0 && (
                <>
                  <h3 className={styles.subTitle}>Slike i video</h3>
                  <div className={styles.mediaGrid}>
                    {report.media.map((item) => (
                      <figure key={item.attachment_id} className={styles.mediaItem}>
                        {isVideoMedia(item) ? (
                          <video className={styles.mediaThumb} src={item.url} controls playsInline preload="metadata" />
                        ) : (
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            <img className={styles.mediaThumb} src={item.url} alt={MEDIA_LABEL[item.attachment_type] ?? "Slika"} loading="lazy" />
                          </a>
                        )}
                        <figcaption className={styles.cardMeta}>{MEDIA_LABEL[item.attachment_type] ?? "Prilog"}</figcaption>
                      </figure>
                    ))}
                  </div>
                </>
              )}

              {report.handover && (
                <>
                  <h3 className={styles.subTitle}>Primopredaja</h3>
                  <dl className={styles.facts}>
                    {report.handover.customer_present ? (
                      <>
                        <dt>Preuzeo</dt>
                        <dd>{[report.handover.receiver_full_name, report.handover.receiver_position].filter(Boolean).join(" · ") || "—"}</dd>
                      </>
                    ) : (
                      <>
                        <dt>Preuzeo</dt><dd>Primalac nije bio prisutan</dd>
                        {report.handover.absence_reason && <><dt>Napomena</dt><dd>{report.handover.absence_reason}</dd></>}
                      </>
                    )}
                    {report.handover.received_at && <><dt>Vreme</dt><dd>{formatDateTime(report.handover.received_at)}</dd></>}
                  </dl>
                  {report.handover.signature && (
                    <div className={styles.signatureBox}>
                      <SignatureImage url={report.handover.signature.url} />
                      <div className={styles.cardMeta}>Potpis primaoca</div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {wo && (
        <div className={styles.section}>
          <h2 className={styles.panelTitle}>Obračun</h2>
          {!calculation ? (
            <div className={styles.muted}>Obračun još nije napravljen.</div>
          ) : calculation.state === "U_PRIPREMI" ? (
            <div className={styles.muted}>Obračun je u pripremi i biće prikazan kada bude završen.</div>
          ) : calculation.state === "BEZ_NAPLATE" ? (
            <div className={styles.success}>{calculation.billing_mode === "WARRANTY" ? "Servis u garanciji — bez naplate." : "Servis bez naplate."}</div>
          ) : (
            <>
              <div className={styles.stack}>
                {calculation.items.map((item, index) => (
                  <div key={index} className={styles.amountRow}>
                    <div>
                      <div className={styles.cardName}>{item.name || "Stavka"}</div>
                      <div className={styles.cardMeta}>
                        {item.quantity} {item.unit || ""} × {money(item.unit_price, calculation.currency)} · PDV {item.vat_rate}%
                      </div>
                    </div>
                    <div className={styles.amount}>{money(item.gross_amount, calculation.currency)}</div>
                  </div>
                ))}
              </div>
              <dl className={`${styles.facts} ${styles.totals}`}>
                <dt>Osnovica</dt><dd>{money(calculation.net_total, calculation.currency)}</dd>
                <dt>PDV</dt><dd>{money(calculation.vat_total, calculation.currency)}</dd>
                <dt>Ukupno</dt><dd><strong>{money(calculation.gross_total, calculation.currency)}</strong></dd>
                {calculation.invoice_number && <><dt>Faktura</dt><dd>{calculation.invoice_number}{calculation.invoice_date ? ` · ${formatDate(calculation.invoice_date)}` : ""}</dd></>}
              </dl>
            </>
          )}
        </div>
      )}

      <div className={styles.section}>
        <button type="button" className={styles.buttonSecondary} onClick={onBack}>← NAZAD NA ZAHTEVE</button>
      </div>
    </section>
  );
}

function EquipmentView({ equipment, loading, onReport }: { equipment: Equipment[]; loading: boolean; onReport: (id: number) => void }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Moji uređaji</h2>
      <p className={styles.muted} style={{ marginTop: 0 }}>Uređaji koje smo povezali sa vama po serijskom broju.</p>
      {loading ? (
        <div className={styles.muted}>Učitavanje...</div>
      ) : equipment.length === 0 ? (
        <div className={styles.emptyBox}>
          Još nema uređaja povezanih sa vašim nalogom. Kvar možete prijaviti i bez toga, izborom „Uređaj nije na listi“, a serviser će uređaj povezati.
        </div>
      ) : (
        <div className={styles.stack}>
          {equipment.map((item) => {
            const tone = item.service_status === "U GARANCIJI" || item.service_status === "LOYALTY" ? styles.badgeDone : "";
            return (
              <article key={item.equipment_unit_id} className={styles.requestCard}>
                <div className={styles.requestHead}>
                  <div>
                    <div className={styles.cardName}>{item.name || "Uređaj"}{item.model ? ` · ${item.model}` : ""}</div>
                    <div className={styles.cardMeta}>SN {item.serial_number || "—"}{item.go_id ? ` · servisni broj ${item.go_id}` : ""}{item.manufacturer ? ` · ${item.manufacturer}` : ""}</div>
                  </div>
                  <span className={`${styles.badge} ${tone}`}>{item.service_status || "VAN GARANCIJE"}</span>
                </div>
                <dl className={styles.facts} style={{ marginTop: 10 }}>
                  <dt>Lokacija</dt><dd>{item.location || "—"}</dd>
                  {item.delivery_date && <><dt>Isporuka</dt><dd>{formatDate(item.delivery_date)}{item.delivery_document_number ? ` · otpremnica ${item.delivery_document_number}` : ""}</dd></>}
                  {item.warranty_end_date && <><dt>Garancija do</dt><dd>{formatDate(item.warranty_end_date)}</dd></>}
                  <dt>Servisi</dt><dd>{item.service_count ? `${item.service_count}, poslednji ${formatDate(item.last_service_at ?? null)}` : "Nije bilo servisa"}</dd>
                </dl>
                <div style={{ marginTop: 10 }}>
                  {item.open_request ? (
                    <span className={styles.muted}>Za ovaj uređaj već postoji otvoren zahtev.</span>
                  ) : (
                    <button type="button" className={styles.buttonSecondary} onClick={() => onReport(item.equipment_unit_id)}>PRIJAVI KVAR</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PartnerCardView({ card }: { card: PartnerCard | null }) {
  if (!card) {
    return <section className={styles.panel}><div className={styles.muted}>Učitavanje...</div></section>;
  }
  const { partner, branches, summary, billed_totals: totals, billed } = card;
  const address = [partner.address, [partner.postal_code, partner.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <section className={styles.panel}>
      <div className={styles.section}>
        <h2 className={styles.panelTitle}>{partner.name}</h2>
        <dl className={styles.facts}>
          {partner.partner_code && <><dt>Šifra kupca</dt><dd>{partner.partner_code}</dd></>}
          {partner.tax_id && <><dt>PIB</dt><dd>{partner.tax_id}</dd></>}
          {partner.registration_number && <><dt>Matični broj</dt><dd>{partner.registration_number}</dd></>}
          {address && <><dt>Adresa</dt><dd>{address}</dd></>}
          {partner.phone && <><dt>Telefon</dt><dd>{partner.phone}</dd></>}
          {partner.email && <><dt>Email</dt><dd>{partner.email}</dd></>}
        </dl>
        <p className={styles.muted}>Ako podaci nisu tačni, javite nam se da ih ispravimo.</p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.panelTitle}>Pregled</h2>
        <div className={styles.statGrid}>
          <div className={styles.stat}><strong>{summary.total}</strong><span>prijava ukupno</span></div>
          <div className={styles.stat}><strong>{summary.open}</strong><span>u toku</span></div>
          <div className={styles.stat}><strong>{summary.finished}</strong><span>završeno</span></div>
          <div className={styles.stat}><strong>{summary.equipment}</strong><span>uređaja</span></div>
        </div>
      </div>

      {branches.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.panelTitle}>{card.branch_restricted ? "Moja lokacija" : "Lokacije"}</h2>
          <div className={styles.stack}>
            {branches.map((branch, index) => (
              <div key={index} className={styles.requestCard}>
                <div className={styles.cardName}>{branch.name}{branch.is_headquarters ? " · sedište" : ""}</div>
                <div className={styles.cardMeta}>{[branch.address, [branch.postal_code, branch.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.panelTitle}>Obračunati servisi</h2>
        {billed.length === 0 ? (
          <div className={styles.muted}>Još nema završenih obračuna.</div>
        ) : (
          <>
            <div className={styles.stack}>
              {billed.map((row, index) => (
                <div key={index} className={styles.amountRow}>
                  <div>
                    <div className={styles.cardName}>RN {row.work_order_number} · SZ-{row.request_number}</div>
                    <div className={styles.cardMeta}>
                      {formatDate(row.invoice_date || row.billed_at)}{row.invoice_number ? ` · faktura ${row.invoice_number}` : " · čeka fakturu"}
                    </div>
                  </div>
                  <div className={styles.amount}>{money(row.gross_total, row.currency)}</div>
                </div>
              ))}
            </div>
            <dl className={`${styles.facts} ${styles.totals}`}>
              {totals.map((total) => (
                <Fragment key={total.currency ?? "-"}><dt>Ukupno{total.currency ? ` (${total.currency})` : ""}</dt><dd><strong>{money(total.gross_total, total.currency)}</strong></dd></Fragment>
              ))}
            </dl>
            <p className={styles.muted}>Iznosi su sa PDV-om, po završenim obračunima servisa. Ovo nije knjigovodstvena kartica uplata.</p>
          </>
        )}
      </div>
    </section>
  );
}
