"""
Analiza los SVG de SVG/ → mapa de assets para la plantilla de cotización.

Por cada SVG extrae: textos (<text>/<tspan>), colores de relleno (fill),
dimensiones y un "tipo de slide" inferido por palabras clave.
Salida: data/processed/svg_assets.json + resumen por consola.

No modifica originales. Uso: python scripts/data/extract_svg_assets.py
"""

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "raw" / "SVG"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

SLIDE_TYPES = {
    "portada": r"propuesta|presupuesto|comercial|portada",
    "contexto": r"contexto|entendimiento",
    "objetivo": r"objetivo",
    "alcance": r"alcance|servicios",
    "metodologia": r"metodolog|etapas|semana|kick off",
    "entregables": r"entregables",
    "equipo": r"equipo|direcci[oó]n|planner",
    "inversion": r"inversi[oó]n|valor|uf|total",
    "condiciones": r"condiciones|pago",
    "cierre": r"gracias|cierre|contact",
}

TEXT_RE = re.compile(r"<text[^>]*>(.*?)</text>", re.S | re.I)
TAG_RE = re.compile(r"<[^>]+>")
FILL_RE = re.compile(r'fill\s*[:=]\s*"?(#[0-9A-Fa-f]{3,6})')
VIEWBOX_RE = re.compile(r'viewBox="([^"]+)"')


def main():
    records = []
    palette = Counter()
    for svg in sorted(SRC.rglob("*.svg")):
        rel = svg.relative_to(SRC)
        raw = svg.read_text(encoding="utf8", errors="ignore")
        texts = []
        for m in TEXT_RE.findall(raw):
            t = re.sub(TAG_RE, " ", m)
            t = re.sub(r"\s+", " ", t).strip()
            if t:
                texts.append(t)
        joined = " ".join(texts).lower()
        types = [k for k, pat in SLIDE_TYPES.items() if re.search(pat, joined)]
        fills = FILL_RE.findall(raw)
        for f in fills:
            palette[f.lower()] += 1
        vb = VIEWBOX_RE.search(raw)
        records.append({
            "file": str(rel),
            "set": rel.parts[0],
            "slide_types": types or ["?"],
            "n_texts": len(texts),
            "sample_text": " | ".join(texts[:6])[:200],
            "colors": sorted(set(f.lower() for f in fills)),
            "viewBox": vb.group(1) if vb else None,
        })

    (OUT / "svg_assets.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf8"
    )
    print(f"SVG analizados: {len(records)}")
    sets = Counter(r["set"] for r in records)
    print("Sets:", dict(sets))
    type_freq = Counter(t for r in records for t in r["slide_types"])
    print("Tipos de slide inferidos:", dict(type_freq))
    print("\nPaleta (top 8 colores):")
    for c, n in palette.most_common(8):
        print(f"  {n:>3}  {c}")
    print(f"\n→ {OUT/'svg_assets.json'}")


if __name__ == "__main__":
    main()
