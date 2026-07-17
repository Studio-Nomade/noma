"""
Extrae y normaliza branding_services_master.xlsx → /data/normalized.

Uso (con el venv activado):
    python scripts/data/extract_services_excel.py

No modifica el archivo original (lee desde /data/raw).
Salida:
    data/normalized/branding_services.json
    data/normalized/branding_services.csv
Imprime un resumen: conteo, subáreas, rango de valores y la UF implícita
(CLP/UF) por fila para detectar la UF de referencia e inconsistencias.
"""

import csv
import json
import statistics
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "raw" / "branding_services_master.xlsx"
OUT = ROOT / "data" / "normalized"
OUT.mkdir(parents=True, exist_ok=True)

# columnas esperadas (A..J)
FIELDS = [
    "service_id",
    "subarea",
    "service",
    "description",
    "deliverables",
    "time",
    "value_uf",
    "value_clp",
    "unit",
    "col_j",
]


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def num(v):
    # openpyxl entrega números nativos; solo parseamos si viniera como texto.
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace("$", "").replace(" ", "")
    # heurística: si hay coma decimal, los puntos son miles
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    ws = wb["Sheet1"]
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    records = []
    implied_uf = []
    issues = []
    for i, r in enumerate(rows, start=2):
        r = list(r) + [None] * (len(FIELDS) - len(r))
        rec = {f: clean(r[j]) for j, f in enumerate(FIELDS)}
        # el nombre vive en col C (service) o, si está vacía, en col J (col_j)
        rec["service"] = rec["service"] or rec["col_j"]
        if not rec["service"]:
            continue
        uf = num(rec["value_uf"])
        clp = num(rec["value_clp"])
        rec["value_uf_num"] = uf
        rec["value_clp_num"] = clp
        rec["price_type"] = "uf" if uf else ("clp_unit" if clp else "sin_valor")
        if uf and clp and uf > 0:
            ratio = round(clp / uf, 1)
            rec["uf_implied"] = ratio
            implied_uf.append(ratio)
        else:
            rec["uf_implied"] = None
            if not uf and not clp:
                issues.append(f"fila {i}: sin valor UF ni CLP ({rec['service']})")
        records.append(rec)

    # detectar ratios UF/CLP atípicos (> ±5% respecto a la moda)
    if implied_uf:
        ref = statistics.mode(implied_uf)
        for rec in records:
            r = rec["uf_implied"]
            if r and abs(r - ref) / ref > 0.05:
                issues.append(
                    f"{rec['service_id']} {rec['service']}: UF/CLP={r} (ref≈{ref})"
                )

    (OUT / "branding_services.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf8"
    )
    with (OUT / "branding_services.csv").open("w", newline="", encoding="utf8") as f:
        w = csv.DictWriter(f, fieldnames=list(records[0].keys()))
        w.writeheader()
        w.writerows(records)

    subareas = {}
    for rec in records:
        subareas[rec["subarea"]] = subareas.get(rec["subarea"], 0) + 1

    print(f"Servicios extraídos: {len(records)}")
    print("\nSubáreas:")
    for k, v in sorted(subareas.items(), key=lambda x: -x[1]):
        print(f"  {v:>3}  {k}")
    uf_vals = [r["value_uf_num"] for r in records if r["value_uf_num"]]
    if uf_vals:
        print(f"\nValor UF: min {min(uf_vals)} · max {max(uf_vals)} · n {len(uf_vals)}")
    if implied_uf:
        print(
            f"UF implícita (CLP/UF): moda≈{statistics.mode(implied_uf)} "
            f"min {min(implied_uf)} max {max(implied_uf)}"
        )
    if issues:
        print(f"\n⚠️ Inconsistencias ({len(issues)}):")
        for x in issues[:10]:
            print("  -", x)
    print(f"\n→ {OUT/'branding_services.json'}")


if __name__ == "__main__":
    main()
