import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { listProjects } from "@/features/asana/asana";
import { listLinksWithStatus } from "@/features/slack-notify/links";
import { SlackLinksBoard } from "@/features/slack-notify/links-board";
import {
  listBotChannels,
  slackBotConfigured,
} from "@/features/slack-notify/slack-bot";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";

export const metadata = { title: "Avisos de Slack" };
export const dynamic = "force-dynamic";

/**
 * Vínculos proyecto de Asana ↔ canal de Slack: qué avisa el bot Noma en cada
 * canal, estado del webhook y aviso de prueba. Solo Dirección.
 */
export default async function SlackLinksPage() {
  const user = await requireUser();
  if (!roleFor(user.email).isSuperAdmin) redirect("/");

  const botConfigured = slackBotConfigured();
  const [links, projects, channels] = await Promise.all([
    listLinksWithStatus(),
    listProjects().catch(() => null),
    botConfigured
      ? listBotChannels().catch((error) => {
          console.error("[slack-links:channels]", error);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const projectOptions =
    projects?.connected === true
      ? projects.data
          .filter((p) => !p.completed)
          .map((p) => ({ gid: p.gid, name: p.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

  const boardLinks = links.map((link) => ({
    id: link.id,
    asanaProjectGid: link.asanaProjectGid,
    asanaProjectName: link.asanaProjectName,
    slackChannelId: link.slackChannelId,
    slackChannelName: link.slackChannelName,
    folioPrefix: link.folioPrefix,
    events: link.events,
    active: link.active,
    webhook: link.webhook,
    lastNotifiedAt: link.lastNotifiedAt?.toISOString() ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Avisos de Slack"
        description="Cada proyecto de Asana avisa en su canal: menciones, tareas reabiertas, cambios de Estado, asignaciones, tareas nuevas y cerradas. Publica solo el bot Noma."
      />
      <SlackLinksBoard
        links={boardLinks}
        projects={projectOptions}
        channels={channels}
        botConfigured={botConfigured}
      />
      {links.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Sin vínculos aún"
          description="Vincula un proyecto o carga los vínculos con npm run slack:seed-links -- --apply."
        />
      ) : null}
    </>
  );
}
