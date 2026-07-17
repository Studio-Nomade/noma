"""
Parsea los nombres de los PDF de PRESUPUESTOS → metadata estructurada.

Nomenclatura observada (con variantes):
    AREA[+AREA...]_[N]AAMMDD[extra] Cliente[  |  - ]Servicio
Ejemplos reales:
    B&D+WD_N251118 - Alianza Chilena de Ciberseguridad _ Branding + Rediseño Web
    CE_20260112 Titania  Diseño Logotipo
    B&D_260123 - Equifax B2B  Propuesta Comercial - Plan Mensual Bold
    A&A_N26010410 Monkey  Producción Audiovisual - Video Corporativo

Salida: data/processed/budgets_index.json + .csv
Incluye `parse_confidence` (high/medium/low) para los nombres ambiguos.
No modifica originales.
"""

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "raw" / "PRESUPUESTOS"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

KNOWN_AREAS = {"B&D", "WD", "A&D", "A&A", "CE", "MP", "SN"}

# AREA(s) _ codigo  resto
HEAD = re.compile(r"^(?P<areas>[A-Z&+]+)_\s*(?P<code>[A-Za-z0-9]+)\s+(?P<rest>.*)$")


def parse_code(code: str):
    """Devuelve (iso_date|None, code_raw). Maneja N-prefijo, YYMMDD y YYYYMMDD."""
    digits = re.sub(r"^[Nn]", "", code)
    digits = re.sub(r"\D", "", digits)
    y = m = d = None
    if len(digits) >= 8:  # YYYYMMDD
        y, m, d = digits[0:4], digits[4:6], digits[6:8]
    elif len(digits) >= 6:  # YYMMDD
        y, m, d = "20" + digits[0:2], digits[2:4], digits[4:6]
    if y and 1 <= int(m or 0) <= 12 and 1 <= int(d or 0) <= 31:
        return f"{y}-{m}-{d}", code
    return None, code


def split_client_service(rest: str):
    """Separa cliente y servicio. Heurística + nivel de confianza."""
    rest = rest.strip().lstrip("-").strip()
    # separadores fuertes: doble espacio, " _ ", " - "
    for sep in ["  ", " _ ", " – ", " - "]:
        if sep in rest:
            a, b = rest.split(sep, 1)
            return a.strip(), b.strip(), "high"
    return rest, None, "low"


def main():
    records = []
    low = []
    for pdf in sorted(SRC.rglob("*.pdf")):
        rel = pdf.relative_to(SRC)
        parts = rel.parts
        year = next((p.split()[-1] for p in parts if p.startswith("Presupuestos")), None)
        area_folder = parts[1] if len(parts) > 2 else None
        stem = pdf.stem
        rec = {
            "file": str(rel),
            "year_folder": year,
            "area_folder": area_folder,
            "areas": None,
            "date": None,
            "code": None,
            "client": None,
            "service_title": None,
            "parse_confidence": "low",
        }
        m = HEAD.match(stem)
        if m:
            areas = [a for a in m.group("areas").split("+")]
            rec["areas"] = areas
            iso, code_raw = parse_code(m.group("code"))
            rec["date"] = iso
            rec["code"] = code_raw
            client, service, conf = split_client_service(m.group("rest"))
            rec["client"] = client
            rec["service_title"] = service
            unknown = [a for a in areas if a not in KNOWN_AREAS]
            rec["parse_confidence"] = (
                "high" if (iso and conf == "high" and not unknown) else
                "medium" if iso else "low"
            )
            if unknown:
                rec["unknown_area_code"] = unknown
        if rec["parse_confidence"] == "low":
            low.append(rec["file"])
        records.append(rec)

    (OUT / "budgets_index.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf8"
    )
    with (OUT / "budgets_index.csv").open("w", newline="", encoding="utf8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "file", "year_folder", "area_folder", "areas", "date",
                "code", "client", "service_title", "parse_confidence",
            ],
        )
        w.writeheader()
        for r in records:
            row = {k: (",".join(v) if isinstance(v, list) else v) for k, v in r.items()
                   if k in w.fieldnames}
            w.writerow(row)

    # resumen
    by_area, by_year, by_conf = {}, {}, {}
    for r in records:
        for a in (r["areas"] or ["?"]):
            by_area[a] = by_area.get(a, 0) + 1
        by_year[r["year_folder"]] = by_year.get(r["year_folder"], 0) + 1
        by_conf[r["parse_confidence"]] = by_conf.get(r["parse_confidence"], 0) + 1
    print(f"PDFs procesados: {len(records)}")
    print("Por año:", by_year)
    print("Por código de área:", dict(sorted(by_area.items(), key=lambda x: -x[1])))
    print("Confianza de parseo:", by_conf)
    if low:
        print(f"\n⚠️ Baja confianza ({len(low)}) — revisar manualmente:")
        for x in low[:12]:
            print("  -", x)
    print(f"\n→ {OUT/'budgets_index.json'}")


if __name__ == "__main__":
    main()
