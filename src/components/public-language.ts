"use client";

import { useSyncExternalStore } from "react";

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("avenli-language", notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener("avenli-language", notify); };
}
function currentLanguage() { return (localStorage.getItem("avenli-language") ?? navigator.language).toLowerCase().startsWith("cs"); }
export function usePublicCzech() { return useSyncExternalStore(subscribe, currentLanguage, () => false); }
export function togglePublicLanguage(cs: boolean) {
  localStorage.setItem("avenli-language", cs ? "en" : "cs");
  window.dispatchEvent(new Event("avenli-language"));
}
