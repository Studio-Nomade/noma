# Taxonomía de servicios

Cómo clasificamos los servicios en Noma (no como lista plana).

## Niveles

```
Área → Subárea → Servicio → (Módulos)
                      ↑
                Nivel de complejidad (para servicios compuestos)
```

## Áreas (catálogo Noma)

| Código | Nombre | En enum hoy |
|---|---|---|
| B&D | Branding & Design | ✅ |
| WD | Web Design | ✅ |
| A&D | Architecture & Design | ✅ |
| A&A | Audiovisual & Animation | ✅ |
| CE | Clínica de Emprendimientos | ✅ |
| **MP** | **Mercado Público** | ❌ **agregar** |
| SN | Studio Nomade · Operations & Governance | ✅ |

> Acción: añadir `MP` al enum de áreas (`src/types/enums.ts` + migración).

## Subáreas de Branding (del Excel)

1. Estrategia de Marca
2. Identidad Visual
3. Implementación de Marca
4. Editorial & Presentaciones
5. Digital & Canales
6. Digital & Técnica
7. Merchandising & Impresión

> Las subáreas de las demás áreas se levantarán al extraer sus PDF (aún no hay
> Excel maestro por área).

## Niveles de complejidad (servicios compuestos)

Para servicios "de marca" que se venden por profundidad:
`Light · Medium · Regular · Bold`.

Varían por: profundidad estratégica, nº de piezas, manual de marca, benchmark,
referentes, sistema gráfico, aplicaciones, presentaciones, acompañamiento, nº de
reuniones y valor. Se modelan con `complexity_level` + composición de **módulos**
(ver services-data-model.md). Los niveles concretos por servicio se confirmarán al
extraer los PDF (los planes digitales del Excel ya insinúan esta lógica:
Inicial / Medio / Avanzado).

## Servicios como módulos

Un servicio compuesto (ej. "Desarrollo de Marca Light") se arma con módulos que
también pueden venderse solos (diagnóstico, benchmark, logotipo, paleta, manual
básico, aplicaciones…). Los módulos alimentan automáticamente alcance,
entregables, valor y, después, el SLA.
