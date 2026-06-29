"""
Extrae texto de los SLA PDF y los segmenta en módulos/cláusulas candidatas.

Salida:
  data/processed/sla_text/<archivo>.txt   (texto completo)
  data/processed/sla_segments.json        (encabezados detectados por archivo)

No modifica originales. Uso: python scripts/data/extract_sla_modules.py
"""

import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "raw" / "SLA"
OUT = ROOT / "data" / "processed"
TXT = OUT / "sla_text"
TXT.mkdir(parents=True, exist_ok=True)

# encabezado candidato: línea corta, mayúsculas o "N. Título" / "N) Título"
HEADER_RE = re.compile(
    r"^\s*(?:\d+[\.\)]\s+.+|[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \-/&]{4,60})\s*$"
)


def main():
    out = []
    for pdf in sorted(SRC.rglob("*.pdf")):
        rel = pdf.relative_to(SRC)
        with pdfplumber.open(pdf) as doc:
            pages = len(doc.pages)
            text = "\n".join((p.extract_text() or "") for p in doc.pages)
        (TXT / rel.with_suffix(".txt")).write_text(text, encoding="utf8")
        headers = []
        for line in text.splitlines():
            ls = line.strip()
            if 5 <= len(ls) <= 60 and HEADER_RE.match(ls):
                headers.append(ls)
        out.append({
            "file": str(rel),
            "pages": pages,
            "chars": len(text),
            "headers": headers,
        })
        print(f"\n=== {rel} ({pages} pág, {len(text)} chars) ===")
        for h in headers:
            print("  ·", h)

    (OUT / "sla_segments.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf8"
    )
    print(f"\n→ {OUT/'sla_segments.json'}")


if __name__ == "__main__":
    main()
