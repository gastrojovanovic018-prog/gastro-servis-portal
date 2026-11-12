"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inter, Outfit } from "next/font/google";
import styles from "./login.module.css";

const displayFont = Outfit({ subsets: ["latin", "latin-ext"], weight: ["700", "800"], variable: "--font-portal-display" });
const bodyFont = Inter({ subsets: ["latin", "latin-ext"], weight: ["400", "600", "700"], variable: "--font-portal-body" });

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setMessage(payload.message ?? "Prijava nije uspela.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setMessage("Prijava trenutno nije dostupna.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>
      <div className={styles.stage}>
      <div className={styles.photo} aria-hidden="true">
        <img src="/login-servis-unox.jpg" alt="" />
        <div className={styles.photoFade} />
      </div>
      <div className={styles.cornerShape} aria-hidden="true" />

      <section className={styles.card} aria-labelledby="portal-login-title">
        <div className={styles.head}>
          <div className={styles.brand}>
            <svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true">
              <path d="M10 0h8L8 30H0z" fill="#E8772A" />
              <path d="M24 0h8L22 30h-8z" fill="#F29A4A" />
            </svg>
            <span>GASTRO OPREMA</span>
          </div>
          <h1 id="portal-login-title" className={styles.title}>Servisni portal</h1>
          <p className={styles.subtitle}>Prijavite se da biste prijavili kvar i pratili status radnog naloga.</p>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label htmlFor="portal-email" className={styles.label}>Email</label>
            <div className={styles.inputWrap}>
              <svg className={styles.inputIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9CFD6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3.5 6.5 12 13l8.5-6.5" />
              </svg>
              <input
                id="portal-email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="Unesite email adresu"
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="portal-password" className={styles.label}>Lozinka</label>
            <div className={styles.inputWrap}>
              <svg className={styles.inputIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9CFD6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="10.5" width="14" height="10" rx="2" />
                <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
                <path d="M12 14.5v2.5" />
              </svg>
              <input
                id="portal-password"
                className={`${styles.input} ${styles.inputWithEye}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Unesite lozinku"
                disabled={loading}
              />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 9 4.5 10 6-.4.6-1.3 1.8-2.6 3" />
                    <path d="M6.6 6.6C4.3 8 2.6 10.2 2 12c1 1.5 5 6 10 6 1.6 0 3-.4 4.3-1" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12c1-1.5 5-6 10-6s9 4.5 10 6c-1 1.5-5 6-10 6S3 13.5 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {message && <div className={styles.errorBox} role="alert">{message}</div>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "PRIJAVLJIVANJE..." : "PRIJAVI SE"}
          </button>
        </form>

        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <p className={styles.register}>
            Nemate nalog? <Link href="/registracija" className={styles.link}>Registrujte se</Link>
          </p>
          <div className={styles.dividerLine} />
        </div>

        <p className={styles.help}>
          Pristup odobravamo posle kratke provere. Zaboravljena lozinka ili pitanja:
          <br />
          Gastro oprema, <a href="tel:+381692131666" className={styles.phone}>069 213 1666</a>.
        </p>
      </section>
      </div>
    </main>
  );
}
