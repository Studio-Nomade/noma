-- ─────────────────────────────────────────────────────────────
-- Noma · Row Level Security (baseline V1)
-- Aplicar en Supabase (SQL editor) DESPUÉS de correr las migraciones.
--
-- V1: todos los usuarios internos autenticados ven y editan todo.
-- La autorización fina (borrado/config por rol admin) se hace en la capa de
-- servidor (server actions). La RLS granular por cliente llega con el portal
-- cliente (V2). Ver docs/decisions/ADR-003-auth-permisos.md.
--
-- Nota: las operaciones con service role (seed, sync de tasas) omiten RLS.
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
    execute format('alter table public.%I enable row level security;', t);

    -- Acceso completo para usuarios autenticados (V1).
    execute format(
      'drop policy if exists %I on public.%I;',
      t || '_authenticated_all', t
    );
    execute format(
      'create policy %I on public.%I
         for all to authenticated
         using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
