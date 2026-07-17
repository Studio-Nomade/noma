# Mapa de la carpeta · Base de Datos | Noma

Inventario de la carpeta fuente `~/Desktop/Base de Datos | Noma` (respaldada en
`/data/raw`, gitignored). Generado por inspección read-only — los originales no se
modifican.

## Resumen

| Tipo              | Cantidad                        |
| ----------------- | ------------------------------- |
| PDF               | 97 (94 presupuestos + 3 SLA)    |
| SVG               | 23                              |
| XLSX              | 1                               |
| JSON (credencial) | 1 — **secreto, fuera del repo** |
| **Total**         | 122                             |

## Estructura

```
Base de Datos | Noma/
├── branding_services_master.xlsx        # 56 servicios Branding (UF+CLP)
├── client_secret_*.json                 # ⚠️ OAuth Google — NO versionar
├── PRESUPUESTOS/
│   ├── Presupuestos 2025/               # 67 PDFs, por área
│   │   ├── Architecture & Design/ (4)
│   │   ├── Audiovisual & Animation/ (15)
│   │   ├── Branding & Design/ (36)
│   │   ├── Solicitudes Equifax/ (5)
│   │   └── Web Design/ (7)
│   └── Presupuestos 2026/               # 27 PDFs, por área
│       ├── Audiovisual & Animation/ (3)
│       ├── Branding & Design/ (12)
│       ├── Clínica de Emprendimientos/ (6)   ← área CE
│       ├── Mercado Público/ (3)              ← área NUEVA (MP)
│       └── Web Design/ (3)
├── SLA/                                  # 3 PDFs (B&D+WD, B&D, WD)
└── SVG/
    ├── ARCHIVO MAESTRO NOMADE/ (15 svg)      # plantilla de deck
    └── WD_N260623 - Punta Volcanes .../ (8 svg)  # propuesta real
```

## Notas

- Presupuestos organizados **por carpeta de área** (no plano) en ambos años.
- **Mercado Público (MP)** aparece como área formalizada en 2026 → debe añadirse
  al catálogo de áreas de Noma (hoy no existe en el enum).
- La credencial Google se trata como secreto: ver
  [extraction-plan.md](extraction-plan.md) y `docs/technical/security.md`.
