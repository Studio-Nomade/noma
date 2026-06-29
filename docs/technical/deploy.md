# Deploy · Noma

La app se aloja en **Vercel** (SSR/Server Actions). Cada rama de GitHub genera un
**preview deployment** con su propia URL; `main` es producción. Ver
[ADR-006](../decisions/ADR-006-deploy.md).

## 1. Conectar el repo a Vercel (una sola vez)

1. Entra a [vercel.com](https://vercel.com) con la cuenta del estudio → **Add New →
   Project**.
2. **Import** el repo `Studio-Nomade/noma` (autoriza GitHub si lo pide).
3. Framework: **Next.js** (autodetectado). No cambies build/output.
4. Antes de "Deploy", agrega las **Environment Variables** (sección siguiente).
5. **Deploy**. Al terminar te da una URL `https://noma-xxxx.vercel.app`.

## 2. Environment Variables (Vercel → Project → Settings → Environment Variables)

| Variable | Valor | Entornos |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lwnrlkkztctxmlrstddd.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_…`) | All |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (`sb_secret_…`) | All |
| `DATABASE_URL` | connection string **pooler transacción (puerto 6543)** | All |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` | `studionomade.cl` | All |
| `MINDICADOR_API_URL` | `https://mindicador.cl/api` | All |

> **Importante:** en Vercel (serverless) usa el **pooler de transacción, puerto
> 6543**:
> `postgresql://postgres.lwnrlkkztctxmlrstddd:[PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres`
> El cliente de BD ya usa `prepare: false`, compatible con ese pooler. (El puerto
> 5432 / session se usa en local para migraciones.)

No definas `NEXT_PUBLIC_SITE_URL` fijo: la app usa el origin de la request, así
funciona en cualquier dominio (preview o producción).

## 3. Habilitar el dominio en Auth (tras el primer deploy)

Con la URL de Vercel ya conocida:

1. **Supabase → Authentication → URL Configuration → Redirect URLs** → agrega:
   - `https://noma-xxxx.vercel.app/**`
   - (y el dominio de cada preview si quieres, o `https://*.vercel.app/**`)
2. **Google Cloud Console → Credenciales OAuth → Authorized redirect URIs**: ya
   apunta al callback de Supabase (`…supabase.co/auth/v1/callback`), **no cambia**.
3. (Opcional) agrega `https://noma-xxxx.vercel.app` a **Authorized JavaScript
   origins** en Google.

Ahora cualquier persona del equipo (con cuenta `@studionomade.cl`) puede entrar
desde cualquier computador con esa URL.

## 4. Dominio propio (cuando estén listos)

`app.studionomade.cl`:
1. Vercel → Project → **Settings → Domains** → agrega `app.studionomade.cl`.
2. En **Cloudflare** (o el DNS del dominio) crea el registro CNAME que indique
   Vercel.
3. Agrega `https://app.studionomade.cl/**` a las Redirect URLs de Supabase.

## 5. Migraciones en producción

Las migraciones se aplican desde local apuntando a la misma base
(`npm run db:migrate`), o en un paso de CI. La base es la misma para local,
preview y producción (un solo proyecto Supabase por ahora).

> Más adelante conviene separar un proyecto Supabase de **staging** para que
> `testing` no toque datos de producción.

## 6. Sync de tasas (cron)

Configurar **Vercel Cron** para `npm run rates:sync` (o un route handler
`/api/rates/sync`) una vez al día. Ver [ADR-005](../decisions/ADR-005-moneda-uf.md).
