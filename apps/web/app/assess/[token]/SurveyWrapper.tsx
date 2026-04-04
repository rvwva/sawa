"use client";
/**
 * SurveyWrapper
 * =============
 * Thin wrapper around SurveyJS that:
 *  - Registers the Arabic locale strings
 *  - Applies the Sawa brand theme
 *  - Switches locale when `lang` changes
 *  - Calls onComplete with the raw data dict
 *
 * Must be dynamically imported (no SSR) because SurveyJS touches window/document.
 */
import { useEffect, useRef } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/defaultV2.min.css";
// Register Arabic built-in locale (navigation button labels, validation messages, etc.)
import "survey-core/i18n/arabic";
import type { Lang } from "@/lib/i18n";

const SAWA_THEME = {
  cssVariables: {
    "--sjs-primary-backcolor":           "#d97c2a",
    "--sjs-primary-backcolor-light":     "#fdf2e6",
    "--sjs-primary-forecolor":           "#ffffff",
    "--sjs-primary-backcolor-dark":      "#b5631c",
    "--sjs-base-unit":                   "8px",
    "--sjs-corner-radius":               "10px",
    "--sjs-shadow-small":                "0 1px 2px 0 rgba(0,0,0,0.06)",
    "--sjs-shadow-medium":               "0 2px 8px 0 rgba(0,0,0,0.08)",
    "--sjs-font-family":                 "Inter, system-ui, sans-serif",
    "--sjs-general-backcolor":           "#ffffff",
    "--sjs-general-backcolor-dim":       "#f8f9fa",
    "--sjs-border-light":                "#e5e7eb",
    "--sjs-border-default":              "#d1d5db",
    "--sjs-special-red":                 "#dc2626",
    "--sjs-special-green":               "#16a34a",
  },
  isPanelless: false,
};

type Props = {
  schema: Record<string, any>;
  lang: Lang;
  onComplete: (data: Record<string, number>) => void;
};

export default function SurveyWrapper({ schema, lang, onComplete }: Props) {
  const modelRef = useRef<Model | null>(null);

  if (!modelRef.current) {
    const model = new Model(schema);
    model.applyTheme(SAWA_THEME as any);
    model.showProgressBar  = "top";
    model.progressBarType  = "pages";
    model.showQuestionNumbers = true;
    model.widthMode = "responsive";
    // Prevent the built-in "completed" page — we handle it ourselves
    model.showCompletedPage = false;
    modelRef.current = model;
  }

  // Switch locale whenever lang prop changes
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.locale = lang === "ar" ? "ar" : "en";
    }
  }, [lang]);

  // Wire complete handler
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    const handler = (sender: Model) => {
      onComplete(sender.data as Record<string, number>);
    };
    model.onComplete.add(handler);
    return () => model.onComplete.remove(handler);
  }, [onComplete]);

  return <Survey model={modelRef.current} />;
}
