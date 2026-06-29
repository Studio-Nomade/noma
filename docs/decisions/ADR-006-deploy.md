# ADR-006 — Estrategia de deploy y dominio

**Estado:** Aceptado · **Fecha:** 2026-06-29

## Contexto

La app debe correr local en desarrollo, tener un **deploy de prueba rápido** para testear el
prototipo, y producción en **`app.studionomade.cl`**. El estudio tiene servidor propio en
**SiteGround**.

## Decisión

- **Alojar la app en Vercel.** Next.js con SSR/Server Actions requiere un runtime Node
  persistente; Vercel es el camino de menor fricción y aporta preview deployments (el "deploy
  rápido" para testear cada rama/PR).
- **Producción:** `app.studionomade.cl` apuntado por **DNS (Cloudflare)** hacia Vercel.
- **SiteGround** sigue sirviendo el sitio público `studionomade.cl` (no la app).
- **GitHub** (repo de Studio Nomade) como remoto y respaldo; Vercel despliega desde GitHub.

## Por qué no SiteGround para la app

SiteGround es hosting compartido (Apache/PHP) y **no ejecuta bien una app Next.js con SSR**.
Forzarla ahí implicaría exportación estática (incompatible con Auth/Server Actions/datos en
vivo) o validar soporte Node/SSH no garantizado.

## Consecuencias

- Pipeline simple: push a GitHub → preview en Vercel → promoción a producción.
- Si más adelante se exige self-hosting, se evaluará un host con Node (VPS) o contenedores;
  la app es portable (no depende de APIs propietarias de Vercel).
