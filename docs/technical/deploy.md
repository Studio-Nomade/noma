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

| Variable                           | Valor                                                  | Entornos |
| ---------------------------------- | ------------------------------------------------------ | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`         | `https://lwnrlkkztctxmlrstddd.supabase.co`             | All      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | publishable key (`sb_publishable_…`)                   | All      |
| `SUPABASE_SERVICE_ROLE_KEY`        | secret key (`sb_secret_…`)                             | All      |
| `DATABASE_URL`                     | connection string **pooler transacción (puerto 6543)** | All      |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` | `studionomade.cl`                                      | All      |
| `MINDICADOR_API_URL`               | `https://mindicador.cl/api`                            | All      |
| `GOOGLE_CLIENT_ID`                 | OAuth client de Google Cloud                           | All      |
| `GOOGLE_CLIENT_SECRET`             | OAuth secret de Google Cloud                           | All      |
| `NOMA_ADMIN_EMAILS`                | correos admin (coma)                                   | All      |
| `NOMA_FINANCE_EMAILS`              | correos de Finanzas (coma)                             | All      |

**Obligatorias para las integraciones de Google.** `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` son las que permiten actuar **como el usuario**: envío de
propuestas por Gmail, creación de reuniones en Calendar/Meet y lectura de notas en
Drive. Sin ellas esas acciones fallan (el resto de la app funciona).

Opcionales (activan integraciones; si faltan, la funcionalidad degrada y avisa):

| Variable              | Para qué                                              |
| --------------------- | ----------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | Procesar notas con Claude (hoy corre una capa mock)    |
| `ASANA_ACCESS_TOKEN`  | Crear la tarea al traspasar a operación                |
| `ASANA_PROJECT_GID`   | Proyecto de Asana donde se crea la tarea               |

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

## 4. Dominio oficial `noma.studionomade.cl`

El dominio `studionomade.cl` vive en **Bluehosting** (DNS `*.dnsmisitio.net`). La app
**no** puede correr en Bluehosting (hosting compartido PHP, sin Node/SSR), así que el
subdominio solo apunta a Vercel. No hay que mover el DNS del dominio raíz.

1. Vercel → Project → **Settings → Domains** → agrega `noma.studionomade.cl`. Vercel
   muestra el valor exacto del **CNAME** (p. ej. `cname.vercel-dns.com`).
2. En **Bluehosting → cPanel → Editor de Zona DNS** de `studionomade.cl`, agrega un
   registro **CNAME**: nombre `noma`, destino el que indicó Vercel. TTL por defecto.
3. Espera la propagación (minutos a ~1 h); Vercel emite el certificado SSL solo.
4. Agrega `https://noma.studionomade.cl/**` a las **Redirect URLs** de Supabase
   (Authentication → URL Configuration) y fija **Site URL** = `https://noma.studionomade.cl`.

> En Vercel, `main` se publica en producción (asígnale `noma.studionomade.cl`) y
> `testing` genera una URL de preview para QA.

### Scopes de Google (re-login obligatorio)

El login pide `gmail.send`, `calendar.events` y `drive.readonly`. Quien ya tenía sesión
con scopes antiguos debe **cerrar sesión y volver a entrar una vez** para concederlos;
si no, agendar reunión y buscar notas en Drive funcionan en modo local y lo avisan.

### Costo

Vercel **Hobby es gratis** y suficiente para testear (incluye dominio propio + SSL).
Para uso comercial formal, **Pro = US$20/usuario/mes**. Se puede partir en Hobby.

## 5. Migraciones en producción

Las aplica **GitHub Actions** (`.github/workflows/migrate.yml`) al hacer merge a
`main`, antes de que Vercel publique: corre `npm run db:deploy` (migraciones) y
`npm run db:policies` (baseline de RLS).

Requiere el secreto de repositorio **`DATABASE_URL`** (GitHub → Settings →
Secrets and variables → Actions). Las tres conexiones de Supabase NO son
intercambiables:

| Uso                    | Conexión (Supabase → Connect) | Host                        | Puerto |
| ---------------------- | ----------------------------- | --------------------------- | ------ |
| App en Vercel          | Transaction pooler            | `aws-*.pooler.supabase.com` | 6543   |
| **Migraciones (CI)**   | **Session pooler**            | `aws-*.pooler.supabase.com` | 5432   |
| Direct connection      | ❌ no usar desde CI            | `db.<ref>.supabase.co`      | 5432   |

> **La "Direct connection" no sirve en GitHub Actions:** solo resuelve en IPv6 y
> los runners son IPv4 — la conexión nunca se establece. El **Session pooler**
> es IPv4 y, al ser modo sesión, soporta el DDL de las migraciones.

El valor va **sin comillas**. Si la contraseña tiene caracteres especiales,
percent-encodearlos (`@` → `%40`, `#` → `%23`, …).

> Ojo: hoy `testing` y producción comparten la misma base. Conviene separar un
> proyecto Supabase de **staging**.

## 6. Sync de tasas (cron)

Configurar **Vercel Cron** para `npm run rates:sync` (o un route handler
`/api/rates/sync`) una vez al día. Ver [ADR-005](../decisions/ADR-005-moneda-uf.md).
