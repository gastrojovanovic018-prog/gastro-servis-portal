"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Uneti podaci forme preživljavaju osvežavanje stranice (F5) dok je kartica pregledača otvorena
 * (sessionStorage), a brišu se odjavom. Isti potpis kao u Gastro Control-u (useWindowState),
 * bez radnih kartica i prozora koji postoje samo tamo.
 */
const PREFIX = "GASTRO_SERVIS_FORM_V1:";

export type WindowStateInfo = { restored: boolean; ready: boolean };

export function useWindowState<T>(part: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>, WindowStateInfo] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const infoRef = useRef<WindowStateInfo>({ restored: false, ready: false });
  const key = PREFIX + part;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) {
        infoRef.current.restored = true;
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // oštećen zapis se ignoriše
    }
    infoRef.current.ready = true;
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value === undefined ? null : value));
    } catch {
      // pun storage
    }
  }, [ready, key, value]);

  return [value, setValue, infoRef.current];
}

/** Odjava: brišu se svi uneti podaci formi. */
export function clearAllWindowDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // bez sessionStorage
  }
}

/** Upozorenje pregledača pri zatvaranju ili napuštanju stranice dok ima nesnimljenih izmena. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
