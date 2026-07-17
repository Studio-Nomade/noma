"""
Extrae texto y patrones de los presupuestos PDF → /data/processed.

- Vuelca el texto de cada PDF en data/processed/pdf_text/<ruta>.txt
- Detecta PDFs escaneados (sin texto seleccionable)
- Cuenta montos UF/CLP y secciones típicas (Alcance, Etapas, Entregables…)
- Índice agregado en data/processed/pdf_content_index.json

No modifica originales. Uso: python scripts/data/extract_pdf_budgets.py
"""

import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "raw" / "PRESUPUESTOS"
OUT = ROOT / "data" / "processed"
TXT = OUT / "pdf_text"
TXT.mkdir(parents=True, exist_ok=True)

SECTIONS = {
    "contexto": r"\bcontexto\b|entendimiento",
    "objetivo": r"\bobjetivo",
    "diagnostico": r"diagn[oó]stico",
    "alcance": r"\balcance",
    "metodologia": r"metodolog[ií]a|etapas",
    "entregables": r"entregables",
    "cronograma": r"cronograma|plazos|timeline",
    "equipo": r"\bequipo",
    "inversion": r"inversi[oó]n|valor|presupuesto|condiciones comerciales",
    "condiciones": r"condiciones|forma de pago",
}
UF_RE = re.compile(r"(\d{1,3}(?:[.,]\d+)?)\s*UF\b", re.I)
CLP_RE = re.compile(r"\$\s?\d{1,3}(?:\.\d{3})+")


def main():
    records = []
    scanned = []
    section_freq = {k: 0 for k in SECTIONS}
    for pdf in sorted(SRC.rglob("*.pdf")):
        rel = pdf.relative_to(SRC)
        try:
            with pdfplumber.open(pdf) as doc:
                pages = len(doc.pages)
                text = "\n".join((p.extract_text() or "") for p in doc.pages)
        except Exception as e:  # noqa: BLE001
            records.append({"file": str(rel), "error": str(e)[:120]})
            continue

        out_txt = TXT / rel.with_suffix(".txt")
        out_txt.parent.mkdir(parents=True, exist_ok=True)
        out_txt.write_text(text, encoding="utf8")

        low = text.lower()
        found = [k for k, pat in SECTIONS.items() if re.search(pat, low)]
        for k in found:
            section_freq[k] += 1
        has_text = len(text.strip()) > 120
        if not has_text:
            scanned.append(str(rel))
        records.append({
            "file": str(rel),
            "pages": pages,
            "chars": len(text),
            "has_text": has_text,
            "uf_hits": len(UF_RE.findall(text)),
            "clp_hits": len(CLP_RE.findall(text)),
            "sections": found,
        })

    (OUT / "pdf_content_index.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf8"
    )
    ok = [r for r in records if r.get("has_text")]
    print(f"PDFs: {len(records)} · con texto: {len(ok)} · escaneados: {len(scanned)}")
    print("\nFrecuencia de secciones (de los con texto):")
    for k, v in sorted(section_freq.items(), key=lambda x: -x[1]):
        print(f"  {v:>3}  {k}")
    if scanned:
        print(f"\n⚠️ Escaneados / sin texto ({len(scanned)}) — requieren OCR:")
        for s in scanned[:15]:
            print("  -", s)
    print(f"\n→ texto en {TXT}")


if __name__ == "__main__":
    main()
