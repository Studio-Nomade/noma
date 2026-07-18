import path from "node:path";
import type { Area } from "@/types/enums";

export type ProposalAssetTheme = "light" | "dark";

const areaKey: Partial<Record<Area, string>> = {
  "B&D": "bd",
  WD: "wd",
  "A&D": "ad",
  "A&A": "aa",
};

export const proposalFixedSlides = {
  manifesto: "/assets/proposals/slides/manifesto.svg",
  bank: "/assets/proposals/slides/bank-information.svg",
} as const;

export function getAreaCover(area: Area): string | null {
  const key = areaKey[area];
  return key ? `/assets/proposals/slides/${key}.png` : null;
}

export function getHeaderLogo(
  area: Area | null,
  theme: ProposalAssetTheme,
): string {
  const key = area ? areaKey[area] : null;
  const asset = key ?? "nomade";
  return `/assets/${key ? "areas" : "brand"}/${asset}-${theme === "dark" ? "white" : "black"}.png`;
}

const teamPhotos: Record<string, string> = {
  "adrian silva": "/assets/team/adrian-silva.png",
  "anna sanhueza": "/assets/team/anna-sanhueza.png",
  "carlos leay": "/assets/team/carlos-leay.png",
  "catalina torres": "/assets/team/catalina-torres.png",
  "hector briceno": "/assets/team/hector-briceno.png",
  "javiera diaz": "/assets/team/javiera-diaz.png",
  "javier diaz": "/assets/team/javiera-diaz.png",
  "maximilian viveros": "/assets/team/maximilian-viveros.png",
  "sebastian robles": "/assets/team/sebastian-robles.png",
};

function normalizedName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .trim();
}

export function getTeamPhoto(name: string): string | null {
  return teamPhotos[normalizedName(name)] ?? null;
}

export function pdfAssetPath(publicPath: string): string {
  return path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
}
