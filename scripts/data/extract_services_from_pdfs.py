"""
Levantamiento de servicios desde TODOS los presupuestos PDF (texto ya extraído
en data/processed/pdf_text/). Detecta candidatos de servicio = título + valor.

Heurística: por cada línea con un valor (`N UF` o `$N.NNN`), el título es el
texto previo en la misma línea. Se limpia ruido y se agrega por área.

Salidas:
  data/normalized/services_candidates.json   (cada ocurrencia)
  data/normalized/services_by_area.json       (agregado por área + título)
No modifica originales. Uso: python scripts/data/extract_services_from_pdfs.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "processed" / "pdf_text"
OUT = ROOT / "data" / "normalized"
OUT.mkdir(parents=True, exist_ok=True)

AREA_BY_CODE = {
    "B&D": "B&D", "WD": "WD", "A&D": "A&D", "A&A": "A&A",
    "CE": "CE", "MP": "MP", "SN": "SN",
}

# valor: "10 UF", "1,5 UF", "$350.000"
UF_LINE = re.compile(r"^(?P<title>.+?)[\s\-–]*(?P<val>\d{1,3}(?:[.,]\d+)?)\s*UF\b", re.I)
CLP_LINE = re.compile(r"^(?P<title>.+?)[\s\-–]*\$\s?(?P<val>\d{1,3}(?:\.\d{3})+)")

NOISE = re.compile(
    r"^(valor|valor único|valor unico|total|subtotal|inversi|presupuesto|"
    r"el presupuesto|equipo|iva|desde|hosting|anual|mensual|trimestral|"
    r"\d+|\W+|.{0,2})$",
    re.I,
)
STRIP_TAIL = re.compile(r"\s*\+?\s*iva\b.*$", re.I)


def area_from_file(rel: str) -> str:
    stem = Path(rel).name
    m = re.match(r"^([A-Z&+]+)_", stem)
    if m:
        first = m.group(1).split("+")[0]
        return AREA_BY_CODE.get(first, first)
    # fallback por carpeta de área
    return "?"


def clean_title(t: str) -> str:
    t = STRIP_TAIL.sub("", t)
    t = re.sub(r"[•·\-–—:>]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip(" .,-–—:")
    return t.strip()


def main():
    candidates = []
    for txt in sorted(SRC.rglob("*.txt")):
        rel = str(txt.relative_to(SRC))
        area = area_from_file(rel)
        for raw in txt.read_text(encoding="utf8", errors="ignore").splitlines():
            line = raw.strip()
            if not line:
                continue
            for rx, cur in ((UF_LINE, "UF"), (CLP_LINE, "CLP")):
                m = rx.match(line)
                if not m:
                    continue
                title = clean_title(m.group("title"))
                if not title or NOISE.match(title):
                    continue
                # título demasiado largo => probablemente un párrafo, no un nombre
                if len(title) > 70:
                    continue
                rawval = m.group("val")
                # UF: el punto es decimal; CLP: el punto es separador de miles
                if cur == "UF":
                    value = float(rawval.replace(",", "."))
                else:
                    value = float(rawval.replace(".", ""))
                candidates.append({
                    "area": area,
                    "file": rel,
                    "title": title,
                    "value": value,
                    "currency": cur,
                    "suspect": cur == "UF" and value > 150,
                })
                break

    (OUT / "services_candidates.json").write_text(
        json.dumps(candidates, ensure_ascii=False, indent=2), encoding="utf8"
    )

    # agregado por área → título normalizado (lower) con conteo y rango de valor
    agg = defaultdict(lambda: defaultdict(list))
    for c in candidates:
        agg[c["area"]][c["title"].lower()].append(c)
    by_area = {}
    for area, titles in agg.items():
        items = []
        for _, occ in titles.items():
            vals = [o["value"] for o in occ]
            items.append({
                "title": occ[0]["title"],
                "currency": occ[0]["currency"],
                "count": len(occ),
                "value_min": min(vals),
                "value_max": max(vals),
                "files": sorted({o["file"].split("/")[-1] for o in occ})[:5],
            })
        items.sort(key=lambda x: -x["count"])
        by_area[area] = items
    (OUT / "services_by_area.json").write_text(
        json.dumps(by_area, ensure_ascii=False, indent=2), encoding="utf8"
    )

    print(f"Candidatos de servicio: {len(candidates)}")
    print("\nServicios DISTINTOS por área (título único):")
    for area in sorted(by_area):
        print(f"  {area:<5} {len(by_area[area]):>3} distintos "
              f"({sum(i['count'] for i in by_area[area])} ocurrencias)")
    print("\nTop títulos por área (muestra):")
    for area in sorted(by_area):
        print(f"\n— {area} —")
        for it in by_area[area][:8]:
            rng = (f"{it['value_min']:g}" if it['value_min'] == it['value_max']
                   else f"{it['value_min']:g}–{it['value_max']:g}")
            print(f"  {it['count']:>2}× {it['title'][:50]:<50} {rng} {it['currency']}")
    print(f"\n→ {OUT/'services_by_area.json'}")


if __name__ == "__main__":
    main()
