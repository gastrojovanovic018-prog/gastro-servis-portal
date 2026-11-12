"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useWindowState } from "@/lib/formDraft";
import { useUnsavedChanges } from "@/lib/formDraft";
import styles from "../portal.module.css";

type RegistrantType = "PRAVNO" | "FIZICKO";

type Form = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  password_repeat: string;
  company_name: string;
  tax_id: string;
  address: string;
  city: string;
  note: string;
  website: string;
};

const emptyForm: Form = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  password_repeat: "",
  company_name: "",
  tax_id: "",
  address: "",
  city: "",
  note: "",
  website: "",
};

type Passwords = Pick<Form, "password" | "password_repeat">;
const emptyPasswords: Passwords = { password: "", password_repeat: "" };
const { password: _p, password_repeat: _pr, ...emptyFields } = emptyForm;

export default function PortalRegistrationPage() {
  // Uneti podaci se pamte dok je prozor otvoren (F5); lozinke se nikada ne čuvaju u nacrtu.
  const [type, setType] = useWindowState<RegistrantType>("portalRegistracija.type", "PRAVNO");
  const [fields, setFields] = useWindowState<Omit<Form, keyof Passwords>>("portalRegistracija.form", emptyFields);
  const [passwords, setPasswords] = useState<Passwords>(emptyPasswords);
  const form: Form = { ...fields, ...passwords };
  const [consent, setConsent] = useWindowState("portalRegistracija.consent", false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const dirty = !done && (consent || type !== "PRAVNO" || Object.values(form).some((v) => v.trim() !== ""));
  useUnsavedChanges(dirty);

  function change(field: keyof Form, value: string) {
    if (field === "password" || field === "password_repeat") setPasswords((current) => ({ ...current, [field]: value }));
    else setFields((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function validate() {
    if (type === "PRAVNO") {
      if (!form.company_name.trim()) return "Unesite naziv firme.";
      if (!/^\d{9}$/.test(form.tax_id.replace(/\D/g, ""))) return "PIB mora imati tačno 9 cifara.";
    }
    if (form.full_name.trim().length < 3) return "Unesite ime i prezime.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return "Unesite ispravan email.";
    if (form.phone.replace(/\D/g, "").length < 6) return "Unesite ispravan broj telefona.";
    if (form.address.trim().length < 3 || form.city.trim().length < 2) return "Adresa i mesto su obavezni.";
    if (form.password.length < 8) return "Lozinka mora imati najmanje 8 karaktera.";
    if (form.password !== form.password_repeat) return "Lozinke se ne poklapaju.";
    if (!consent) return "Potrebna je saglasnost za obradu podataka.";
    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrant_type: type,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          company_name: type === "PRAVNO" ? form.company_name.trim() : "",
          tax_id: type === "PRAVNO" ? form.tax_id.trim() : "",
          address: form.address.trim(),
          city: form.city.trim(),
          note: form.note.trim(),
          consent,
          website: form.website,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.message ?? "Registracija nije uspela.");
        return;
      }
      // Posle uspešne registracije nacrt se briše.
      setFields(emptyFields); setPasswords(emptyPasswords); setConsent(false); setType("PRAVNO");
      setDone(true);
    } catch {
      setError("Registracija trenutno nije moguća.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <main className={`${styles.page} ${styles.center}`}>
        <section className={styles.card}>
          <div className={styles.brand}>Gastro Oprema</div>
          <h1 className={styles.title}>Zahtev je poslat</h1>
          <p className={styles.subtitle}>
            Proverićemo vaše podatke i javiti vam se telefonom. Kada odobrimo pristup, prijavite se
            emailom <strong>{form.email.trim()}</strong> i lozinkom koju ste upravo uneli.
          </p>
          <Link href="/login" className={styles.link}>Na prijavu →</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={`${styles.page} ${styles.center}`}>
      <section className={`${styles.card} ${styles.cardWide}`}>
        <div className={styles.brand}>Gastro Oprema</div>
        <h1 className={styles.title}>Registracija za servisni portal</h1>
        <p className={styles.subtitle}>
          Preko portala prijavljujete kvar i pratite status radnog naloga. Pristup odobravamo posle
          kratke provere podataka.
        </p>

        <form onSubmit={submit} className={styles.stack} noValidate>
          <div className={styles.segmented} role="radiogroup" aria-label="Vrsta korisnika">
            <button
              type="button"
              role="radio"
              aria-checked={type === "PRAVNO"}
              className={`${styles.segment} ${type === "PRAVNO" ? styles.segmentActive : ""}`}
              onClick={() => { setType("PRAVNO"); setError(""); }}
            >
              PRAVNO LICE
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={type === "FIZICKO"}
              className={`${styles.segment} ${type === "FIZICKO" ? styles.segmentActive : ""}`}
              onClick={() => { setType("FIZICKO"); setError(""); }}
            >
              FIZIČKO LICE
            </button>
          </div>

          {type === "PRAVNO" && (
            <div className={styles.grid2}>
              <label className={styles.label}>
                Naziv firme *
                <input className={styles.input} value={form.company_name} onChange={(e) => change("company_name", e.target.value)} autoComplete="organization" disabled={sending} />
              </label>
              <label className={styles.label}>
                PIB *
                <input className={styles.input} value={form.tax_id} onChange={(e) => change("tax_id", e.target.value)} inputMode="numeric" maxLength={11} disabled={sending} />
              </label>
            </div>
          )}

          <div className={styles.grid2}>
            <label className={styles.label}>
              {type === "PRAVNO" ? "Ime i prezime kontakt osobe *" : "Ime i prezime *"}
              <input className={styles.input} value={form.full_name} onChange={(e) => change("full_name", e.target.value)} autoComplete="name" disabled={sending} />
            </label>
            <label className={styles.label}>
              Telefon *
              <input className={styles.input} value={form.phone} onChange={(e) => change("phone", e.target.value)} type="tel" autoComplete="tel" disabled={sending} />
            </label>
            <label className={styles.label}>
              Adresa *
              <input className={styles.input} value={form.address} onChange={(e) => change("address", e.target.value)} autoComplete="street-address" disabled={sending} />
            </label>
            <label className={styles.label}>
              Mesto *
              <input className={styles.input} value={form.city} onChange={(e) => change("city", e.target.value)} autoComplete="address-level2" disabled={sending} />
            </label>
            <label className={`${styles.label} ${styles.full}`}>
              Email (za prijavu) *
              <input className={styles.input} value={form.email} onChange={(e) => change("email", e.target.value)} type="email" autoComplete="email" disabled={sending} />
            </label>
            <label className={styles.label}>
              Lozinka *
              <input className={styles.input} value={form.password} onChange={(e) => change("password", e.target.value)} type="password" autoComplete="new-password" disabled={sending} />
            </label>
            <label className={styles.label}>
              Ponovite lozinku *
              <input className={styles.input} value={form.password_repeat} onChange={(e) => change("password_repeat", e.target.value)} type="password" autoComplete="new-password" disabled={sending} />
            </label>
            <label className={`${styles.label} ${styles.full}`}>
              Napomena
              <textarea className={styles.textarea} value={form.note} onChange={(e) => change("note", e.target.value)} placeholder="Npr. koje uređaje imate ili kako da vas najlakše dobijemo" disabled={sending} />
            </label>
          </div>

          <label className={styles.trap} aria-hidden="true">
            Website
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => change("website", e.target.value)} />
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setError(""); }} disabled={sending} />
            <span>
              Saglasan/na sam da Gastro Oprema obrađuje unete podatke radi otvaranja naloga, prijave
              servisa i obaveštavanja o statusu radnih naloga.
            </span>
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.button} disabled={sending}>
            {sending ? "SLANJE..." : "POŠALJI ZAHTEV ZA PRISTUP"}
          </button>
        </form>

        <div className={styles.links}>
          <span className={styles.muted}>Već imate nalog?</span>
          <Link href="/login" className={styles.link}>Prijavite se</Link>
        </div>
      </section>
    </main>
  );
}
