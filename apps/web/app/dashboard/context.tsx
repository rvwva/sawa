"use client";
import { createContext, useContext } from "react";
import type { Lang } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DashUser = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  organisationId: string;
};

// ─── Language context ─────────────────────────────────────────────────────────

export const DashLangContext = createContext<Lang>("en");

export function useDashLang(): Lang {
  return useContext(DashLangContext);
}

// ─── User context ─────────────────────────────────────────────────────────────

export const DashUserContext = createContext<DashUser | null>(null);

export function useDashUser(): DashUser | null {
  return useContext(DashUserContext);
}
