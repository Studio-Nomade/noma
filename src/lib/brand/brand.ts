import type { Area } from "@/types/enums";

/**
 * Base de marca de Studio Nomade — fuente única para la cotización/deck.
 * El equipo de diseño afina aquí + reemplaza los assets en `public/brand/`.
 * Colores extraídos del deck real (ver docs/proposals/svg-assets-map.md).
 */
export const BRAND = {
  name: "Studio Nomade",
  tagline: "Creatividad con propósito",
  email: "contact@studionomade.cl",
  site: "www.studionomade.cl",
  phone: "+56 9 3404 5111",
  address: "Av. Providencia 1208, Of. 207 · Santa Beatriz 100, Of. 1101",
  instagram: "@studionomade_",
  // Datos de transferencia (del pie de los presupuestos reales)
  bank: {
    razonSocial: "Studio Nomade SpA",
    rut: "77.333.406-4",
    banco: "Banco de Crédito e Inversiones",
    tipoCuenta: "Cuenta Corriente",
    numeroCuenta: "89784081",
    email: "contact@studionomade.cl",
  },
  // Assets (placeholders hasta el Design System). Reemplazar en public/brand/.
  logo: "/brand/logo/nomade.svg",
  colors: {
    ink: "#1d1d1b", // negro editorial
    cream: "#ecf0ee", // crema / fondo
    accent: "#f48134", // naranja Nomade
    white: "#ffffff",
  },
} as const;

export type AreaTheme = {
  label: string;
  accent: string;
  /** Banner opcional por área (lo provee el Design System). */
  banner?: string;
};

/**
 * Tema por área: etiqueta + color de acento (+ banner opcional).
 * Acentos provisorios dentro de la paleta Nomade; el equipo de diseño los ajusta.
 */
export const AREA_THEME: Record<Area, AreaTheme> = {
  "B&D": { label: "Branding & Design", accent: "#f48134" },
  WD: { label: "Web Design", accent: "#1d1d1b" },
  "A&D": { label: "Architecture & Design", accent: "#8a6d3b" },
  "A&A": { label: "Audiovisual & Animation", accent: "#a0de00" },
  CE: { label: "Clínica de Emprendimientos", accent: "#c96a4a" },
  MP: { label: "Mercado Público", accent: "#2f6f6f" },
  SN: { label: "Studio Nomade", accent: "#1d1d1b" },
  CSM: { label: "Content & Social Media", accent: "#d4467a" },
  STR: { label: "Strategy / Consultoría", accent: "#5b5bd6" },
};
