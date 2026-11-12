# Gastro servis portal

Javni servis portal za kupce Gastro opreme — `servis.gastrooprema.rs`.

Kupac ovde: prijavljuje se, vidi svoje uređaje i istoriju servisa, prijavljuje kvar i prati status naloga.

## Bezbednost — kako je odvojeno

```
Kupac ──► servis portal (ovaj projekat) ──Bearer PORTAL_GATEWAY_KEY──► Gastro Control /api/portal-gateway ──► baza
```

- Ovaj projekat **nema ključ baze i ne zna adresu baze**.
- Sa Gastro Control-om razgovara samo njegov **server**, preko `POST /api/portal-gateway` i tajnog ključa.
- Pregledač kupca razgovara samo sa ovim portalom; tokeni kupca su u httpOnly kolačićima.
- Ugovor API-ja: `docs/portal-gateway.md` u repozitorijumu `gastroopremacis`.

## Podešavanje (Vercel, Production)

| Promenljiva | Vrednost |
| --- | --- |
| `GASTRO_CONTROL_URL` | adresa Gastro Control-a, npr. `https://gastroopremacis.vercel.app` |
| `PORTAL_GATEWAY_KEY` | isti ključ kao u Gastro Control-u (najmanje 32 znaka) |

## Status

- [x] Korak 1 — API (portal gateway) u Gastro Control-u
- [ ] Korak 2 — aplikacija portala (ovaj repozitorijum)
- [ ] Korak 3 — domen `servis.gastrooprema.rs`
- [ ] Korak 4 — probni rad uporedo sa starim `/portal`
- [ ] Korak 5 — gašenje starog `/portal` i VPN za Gastro Control
