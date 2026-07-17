-- ─────────────────────────────────────────────────────────────
-- Noma · Row Level Security (deny-by-default)
-- Aplicar en Supabase (SQL editor) o con: npm run db:policies
--
-- Modelo de seguridad de V1:
--   · La app accede a los datos SOLO server-side, vía Drizzle/DATABASE_URL con
--     el rol `postgres` (owner), que OMITE RLS. Las server actions validan la
--     sesión (requireUser) y el rol cuando corresponde (requireAdmin).
--   · La API de datos pública (PostgREST/supabase-js) NO se usa. Por eso los
--     roles `anon` y `authenticated` NO deben tener acceso directo a las tablas.
--
-- Esto resuelve el linter `rls_policy_always_true`: en vez de políticas
-- permisivas (USING true), dejamos RLS activa SIN políticas (deny-by-default)
-- y revocamos los privilegios de los roles del API.
--
-- Cuando llegue el portal cliente (V2) se agregarán políticas específicas por
-- cliente y los grants necesarios. Ver docs/decisions/ADR-003-auth-permisos.md.
-- ─────────────────────────────────────────────────────────────

-- Recorre TODAS las tablas de `public` (no una lista fija): así cada tabla nueva
-- queda protegida al re-aplicar, sin depender de que alguien recuerde agregarla.
--
-- `anon` y `authenticated` son roles de Supabase: en un Postgres local no existen,
-- por eso los revokes se omiten si no están (el script corre en local y en prod).
do $$
declare
  t text;
  api_roles text;
begin
  select string_agg(quote_ident(rolname), ', ')
    into api_roles
    from pg_roles
    where rolname in ('anon', 'authenticated');

  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    -- RLS activa (sin políticas permisivas → deny-by-default para no-owners).
    execute format('alter table public.%I enable row level security;', t);

    -- Quitar la política permisiva baseline previa, si existe.
    execute format(
      'drop policy if exists %I on public.%I;',
      t || '_authenticated_all', t
    );

    -- Revocar acceso directo de los roles del API de datos (defensa en profundidad).
    if api_roles is not null then
      execute format('revoke all on public.%I from %s;', t, api_roles);
    end if;
  end loop;

  -- Tablas FUTURAS: que nazcan sin acceso de los roles del API aunque todavía no
  -- se haya vuelto a aplicar este script.
  if api_roles is not null then
    execute format(
      'alter default privileges in schema public revoke all on tables from %s;',
      api_roles
    );
  end if;
end $$;
