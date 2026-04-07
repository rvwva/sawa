"use client";
import { createContext, useContext } from "react";
import type { Lang } from "@/lib/i18n";

export const AdminLangContext = createContext<Lang>("en");

export function useAdminLang(): Lang {
  return useContext(AdminLangContext);
}
