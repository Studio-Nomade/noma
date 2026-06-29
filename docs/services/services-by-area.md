# Levantamiento de servicios por área (borrador para validación)

Fuente: `branding_services_master.xlsx` (B&D) + lectura de los **94 presupuestos
PDF** (texto en `data/processed/pdf_text/`). Extracción asistida en
`scripts/data/extract_services_from_pdfs.py` → `data/normalized/services_by_area.json`
(242 candidatos). **Valores referenciales en UF + IVA**, salvo MP (CLP por unidad).

> ⚠️ Borrador: la extracción desde decks es imperfecta (layout vectorizado). Esta
> tabla está curada a partir de la lectura, pero **requiere validación humana**
> antes de importar. Los `?` marcan valores a confirmar.

## B&D · Branding & Design
Catálogo autoritativo en el Excel (**56 servicios**, ya importados) en 7 subáreas:
Estrategia de Marca · Identidad Visual · Implementación de Marca · Editorial &
Presentaciones · Digital & Canales · Digital & Técnica · Merchandising & Impresión.
En los PDF de B&D también aparecen servicios **web/digitales** (que en rigor son WD,
vendidos en combos B&D+WD).

## WD · Web Design
| Servicio | Valor (UF) | Notas |
|---|---|---|
| Diseño y Desarrollo Web | 9–40 | según nº de secciones/complejidad |
| Rediseño y Desarrollo Web | 10 | |
| Migración Web Full | 5 | + Hosting anual 2 UF |
| Mantención Web (Trimestral) — Light / Medium / Bold | desde 3 | niveles (`complexity_level`) |
| Configuración Sitio Multidiomas | 4 | |
| Hosting Anual | 2 | recurrente |
| Google Ads / Campaña Display | ~65 | |

## A&A · Audiovisual & Animation
| Servicio | Valor (UF) | Notas |
|---|---|---|
| Producción Audiovisual (Video Corporativo) | 17–48 (mayores en proyectos grandes) | |
| Comercial TV / Spot | ? | Equifax |
| Cápsula Corporativa / Documental | 16–48 | |
| Cobertura de Evento (RRSS / Experiencia) | 10–46 | varias modalidades |
| Video Presentación \| CMS | 10 | |
| Sesión Audiovisual y Edición | 12 | guion literario+técnico, voz en off |

## A&D · Architecture & Design
| Servicio | Valor (UF) | Notas |
|---|---|---|
| Diseño de Stand Publicitario | 14 | layout, memoria, plano, gráfica lateral, modelado 3D, 3 renders |
| Memoria Constructiva | 14 | |
| Supervisión y Ejecución de Obra | 1 UF/hora · Visita Técnica 2 | tarifa por hora |
| Render / Modelado 3D | (incluido en stand) | |
| Diseño de Packaging | 9 | combo B&D+A&D |

## CE · Clínica de Emprendimientos
Segmento **emprendedores**: branding/identidad a tarifa de clínica. Servicios se
solapan con B&D.
| Servicio | Valor | Notas |
|---|---|---|
| Creación de Logotipo Simple | 3,78 UF | |
| Desarrollo de Identidad / Branding | ~$1.600.000 CLP | metodología por semanas |
| Plan "Clínica de Emprendimiento" | $400.000 CLP | tarifa especial del programa |
| Desarrollo de Imágenes / Render (loteo) | $130.000 CLP | ej. Punta Volcanes |

## MP · Mercado Público
**Producción gráfica / impresión**, cotizada en **CLP por unidad** (+ despacho):
| Producto | Valor unitario | Notas |
|---|---|---|
| Pendón Roller Retráctil PVC (80×180) | 61.685 CLP/u | + despacho |
| Tríptico Carta 150g (6 caras) | 1.374 CLP/u | tiradas de 1.000 |
| (Otros: impresión gráfica, gigantografías) | CLP/u | `price_type = unit` |
| Estrategia Digital / RRSS sector público | UF/mes | algunos MP son digitales |

## Siguientes pasos
1. **Validar** esta tabla (sobre todo A&A/A&D values y MP).
2. Normalizar a `data/normalized/services_<area>.json` e **importar** (como se hizo
   con B&D), con `price_type` correcto (uf / unit) y `complexity_level` en los que
   tienen niveles (Mantención Web, planes).
3. Alimentar el desplegable **Tipo de Proyecto** (ver project-types.md).
