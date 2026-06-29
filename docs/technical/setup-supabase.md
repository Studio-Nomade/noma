# Setup de Supabase · Noma

Pasos para conectar Noma a un proyecto Supabase. Requiere acceso a una cuenta Supabase.

## 1. Crear el proyecto

1. Crear un proyecto en [supabase.com](https://supabase.com), región **South America
   (sa-east-1)** para menor latencia desde Chile.
2. Guardar la contraseña de la base de datos.

## 2. Variables de entorno

Copiar `.env.example` a `.env.local` y completar desde **Project Settings → API** y
**→ Database**:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # solo servidor
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=studionomade.cl   # opcional
```

## 3. Esquema de base de datos

```bash
npm run db:migrate     # aplica las migraciones de src/db/migrations
# (alternativa rápida en dev: npm run db:push)
```

Luego aplicar las políticas RLS: abrir **SQL Editor** en Supabase y ejecutar el contenido de
[`src/db/policies.sql`](../../src/db/policies.sql).

## 4. Datos iniciales

```bash
npm run db:seed        # studio_config + servicios demo
npm run rates:sync     # carga UF y dólar del día
```

## 5. Google Workspace SSO

1. En **Google Cloud Console** crear credenciales OAuth 2.0 (tipo "Web application").
2. Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
3. En Supabase **Authentication → Providers → Google**: pegar Client ID y Client Secret,
   habilitar.
4. En **Authentication → URL Configuration**: agregar `http://localhost:3000` y
   `https://app.studionomade.cl` a Site URL / Redirect URLs.
5. (Opcional) restringir el dominio con `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` (validado en
   `/auth/callback`).

## 6. Verificar

```bash
npm run dev
```

Ir a `http://localhost:3000` → redirige a `/login` → "Continuar con Google" → Dashboard.

## 7. Sincronización diaria de tasas (producción)

Configurar un cron (Vercel Cron) que ejecute el sync de tasas una vez al día (o llamar al
route handler `/api/rates/sync`). Ver [ADR-005](../decisions/ADR-005-moneda-uf.md).
