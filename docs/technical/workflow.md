# Flujo de trabajo y QA · Noma

## Ramas

| Rama      | Propósito                                  | Vercel                          |
| --------- | ------------------------------------------ | ------------------------------- |
| `main`    | Código estable / **producción**            | Production deployment           |
| `testing` | Integración y **QA** antes de pasar a main | Preview deployment (URL propia) |

Regla: **nada llega a `main` sin pasar por `testing` y aprobar el QA.**

## Ciclo

1. El trabajo nuevo (features, fixes) se commitea en **`testing`**.
2. Vercel publica automáticamente un **preview** de `testing` con su URL → el
   equipo prueba ahí.
3. Se corre el **checklist de QA** (abajo).
4. Si pasa, se integra `testing` → `main` (merge / PR) y Vercel actualiza
   producción.

```
feature work ──▶ testing ──(QA ✓)──▶ main ──▶ producción
                    │
                    └─ preview URL para testear en el equipo
```

## Checklist de QA (antes de pasar a `main`)

- [ ] `npm run typecheck` sin errores
- [ ] `npm run lint` sin errores
- [ ] `npm run build` exitoso
- [ ] Flujo principal probado en el preview: login → crear/editar/listar la
      entidad afectada → ver detalle
- [ ] Sin errores en consola del navegador ni en logs del server
- [ ] Estados vacíos / carga / error revisados
- [ ] Linter de seguridad de Supabase sin nuevos warnings (si hubo cambios de BD)
- [ ] Migraciones aplicadas y documentadas (si cambió el schema)

## Comandos útiles

```bash
git switch testing            # cambiar a la rama de pruebas
git switch -c testing         # crearla (si no existe localmente)
# … trabajo y commits …
git push origin testing       # publica el preview en Vercel

# pasar a producción cuando QA pasa:
git switch main && git merge --no-ff testing && git push origin main
```

## Convención de commits

`tipo(scope): descripción` — tipos: `feat`, `fix`, `chore`, `docs`, `refactor`.
Ej: `feat(fase-2): módulo de Servicios`.
