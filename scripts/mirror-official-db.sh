#!/usr/bin/env bash
# Copia los datos de negocio de la BBDD OFICIAL (Supabase) a la BBDD LOCAL.
# Trae clientes, equipo, servicios (por área), proyectos, briefs y propuestas.
# NO toca las tablas del módulo CFO/Finanzas (plan de cuentas, banco, etc.),
# que se pueblan con `npm run db:seed`.
#
# Uso:
#   OFFICIAL_DATABASE_URL="postgresql://postgres.PROJ:PASS@...pooler.supabase.com:5432/postgres" \
#   DATABASE_URL="postgresql://postgres@localhost:5432/noma" \
#   bash scripts/mirror-official-db.sh
#
# Si no se pasan por env, toma DATABASE_URL de .env.local (local) y exige
# OFFICIAL_DATABASE_URL. Requiere `psql` (v16+; funciona contra Supabase PG17).
set -euo pipefail

# Carga DATABASE_URL local desde .env.local si no viene por entorno.
if [[ -z "${DATABASE_URL:-}" && -f .env.local ]]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d'=' -f2- | tr -d '"')
fi
: "${OFFICIAL_DATABASE_URL:?Falta OFFICIAL_DATABASE_URL (conexión a Supabase)}"
: "${DATABASE_URL:?Falta DATABASE_URL (conexión local)}"

DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

# Tablas en orden padre→hijo (el truncate se hace todo junto con CASCADE).
LOAD_ORDER=(clients team_members services studio_config email_templates \
  exchange_rates projects briefs proposals proposal_services proposal_team \
  client_contacts)

echo "→ Exportando desde la BBDD oficial…"
for t in "${LOAD_ORDER[@]}"; do
  cols=$(psql "$DATABASE_URL" -tAc "select string_agg(quote_ident(column_name), ',') from (select column_name from information_schema.columns where table_name='$t' and table_schema='public' order by ordinal_position) s")
  echo "$cols" > "$DIR/$t.cols"
  psql "$OFFICIAL_DATABASE_URL" -c "\copy (select $cols from public.\"$t\") to '$DIR/$t.csv' with csv"
done

echo "→ Vaciando tablas de negocio locales (CASCADE; no toca Finanzas)…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE \
  public.clients, public.team_members, public.services, public.service_modules, \
  public.service_module_links, public.studio_config, public.email_templates, \
  public.exchange_rates, public.projects, public.briefs, public.brief_notes, \
  public.brief_versions, public.brief_meetings, public.proposals, \
  public.proposal_services, public.proposal_team, public.proposal_notes, \
  public.client_contacts, public.resource_links, public.slas, public.invoices, \
  public.cfo_requests, public.knowledge_docs, public.context_documents \
  RESTART IDENTITY CASCADE;"

echo "→ Cargando en local…"
for t in "${LOAD_ORDER[@]}"; do
  cols=$(cat "$DIR/$t.cols")
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\copy public.\"$t\" ($cols) from '$DIR/$t.csv' with csv"
  echo "  ✓ $t"
done

echo "✓ Mirror completo. Recuerda: 'npm run db:seed' repuebla el plan de cuentas de Finanzas."
