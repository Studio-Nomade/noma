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

do $$
declare
  t text;
  tables text[] := array[
    'clients', 'projects', 'briefs', 'services', 'proposals',
    'proposal_services', 'resource_links', 'studio_config',
    'team_members', 'knowledge_docs', 'context_documents',
    'exchange_rates', 'activity_log'
  ];
begin
  foreach t in array tables loop
    -- RLS activa (sin políticas permisivas → deny-by-default para no-owners).
    execute format('alter table public.%I enable row level security;', t);

    -- Quitar la política permisiva baseline previa, si existe.
    execute format(
      'drop policy if exists %I on public.%I;',
      t || '_authenticated_all', t
    );

    -- Revocar acceso directo de los roles del API de datos (defensa en profundidad).
    execute format('revoke all on public.%I from anon, authenticated;', t);
  end loop;
end $$;
