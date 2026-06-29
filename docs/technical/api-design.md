# API & acceso a datos · Noma

No exponemos una API REST pública en V1. La interacción con datos se hace con primitivas de
Next.js App Router.

## Lectura — Server Components

Las páginas y componentes de servidor leen directo con Drizzle:

```ts
// src/features/clients/queries.ts
import { db } from "@/db";
import { clients } from "@/db/schema";

export async function listClients() {
  return db.select().from(clients).orderBy(clients.company_name);
}
```

## Escritura — Server Actions

Cada mutación es una Server Action que (1) verifica sesión, (2) valida con Zod, (3) escribe,
(4) revalida.

```ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { clients } from "@/db/schema";

const ClientInput = z.object({
  company_name: z.string().min(1),
  email: z.string().email().optional(),
  // ...
});

export async function createClient(values: z.infer<typeof ClientInput>) {
  await requireUser();
  const data = ClientInput.parse(values);
  const [row] = await db.insert(clients).values(data).returning();
  revalidatePath("/clients");
  return row;
}
```

## Convenciones

- **Un schema Zod por entidad/área**, compartido entre formulario (react-hook-form +
  `@hookform/resolvers/zod`) y server action.
- **Autorización**: `requireUser()` en toda acción; `requireAdmin()` para borrado y
  configuración global.
- **Dinero**: las acciones reciben `*_amount` + `*_currency`; la conversión es de presentación.
- **Borrados lógicos**: clientes → `Cerrado`, propuestas → `Rechazada` (no DELETE físico).
- **Errores**: se devuelven como resultado tipado (`{ ok: false, error }`) para feedback
  inline; no se lanzan al cliente con detalle técnico.

## Endpoints internos (route handlers)

- `/auth/callback` — intercambio de código OAuth.
- `/api/rates/sync` (opcional) — disparador del sync de tasas para cron de Vercel; también
  ejecutable por `npm run rates:sync`.
