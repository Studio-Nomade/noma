import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EMAIL_FLOW_EVENTS,
  asanaHtmlToMrkdwn,
  assignedMessage,
  completedMessage,
  groupedBody,
  newTaskMessage,
  stateChangeMessage,
  eventEnabled,
  mentionMessage,
  mentionedUserGids,
  reopenedMessage,
  slackMention,
  storyEventKind,
  truncateMrkdwn,
} from "./format";
import { linkEvents, slackLinksFileSchema } from "./links-config";

const user = (gid: string, name: string) =>
  `<a href="https://app.asana.com/0/profile/${gid}" data-asana-gid="${gid}" data-asana-accessible="true" data-asana-type="user" data-asana-dynamic="true">@${name}</a>`;

const html = `<body>${user("111", "Persona Uno")} te reabro la tarea con un <strong>ajuste</strong> del cliente: unificar el azul a <em>C100 M88</em> &amp; revisar <a href="https://example.com/x?a=1&amp;b=2">el archivo</a>.\n<ul><li>uno</li><li>dos &lt;3</li></ul>${user("222", "Persona Dos")}</body>`;

test("menciones del comentario", () => {
  assert.deepEqual(mentionedUserGids(html), ["111", "222"]);
  assert.deepEqual(mentionedUserGids("<body>sin mención</body>"), []);
  // Un enlace a otra tarea no es una mención.
  assert.deepEqual(
    mentionedUserGids(
      '<body><a data-asana-gid="9" data-asana-type="task">T</a></body>',
    ),
    [],
  );
});

test("tipo de aviso según la story", () => {
  assert.equal(
    storyEventKind({ resource_subtype: "comment_added", html_text: html }),
    "mention",
  );
  assert.equal(
    storyEventKind({
      resource_subtype: "comment_added",
      html_text: "<body>ok</body>",
    }),
    null,
  );
  assert.equal(
    storyEventKind({ resource_subtype: "marked_incomplete" }),
    "reopened",
  );
  assert.equal(storyEventKind({ resource_subtype: "added_to_task" }), null);
});

test("HTML de Asana → mrkdwn de Slack", () => {
  const out = asanaHtmlToMrkdwn(html, new Map([["111", "U0AAA111"]]));
  assert.match(out, /^<@U0AAA111> te reabro/);
  assert.match(out, /\*ajuste\*/);
  assert.match(out, /_C100 M88_ &amp; revisar/);
  assert.match(out, /<https:\/\/example\.com\/x\?a=1&amp;b=2\|el archivo>/);
  assert.match(out, /• uno\n• dos &lt;3/);
  // Sin usuario de Slack: nombre en negrita, sin mención.
  assert.match(out, /\*Persona Dos\*$/);
  // El texto del usuario nunca abre un token de Slack.
  assert.equal(
    asanaHtmlToMrkdwn("<body>&lt;!channel&gt; hola</body>"),
    "&lt;!channel&gt; hola",
  );
});

test("recorte sin romper tokens", () => {
  const s = `${"a".repeat(190)} <https://example.com|enlace largo>`;
  const cut = truncateMrkdwn(s);
  assert.ok(cut.endsWith("…"));
  assert.ok(!cut.includes("<"));
  assert.equal(truncateMrkdwn("corto", 600), "corto");
});

test("mensajes de mención y de tarea reabierta", () => {
  const task = {
    name: "Vector rotulado",
    url: "https://app.asana.com/0/1/2/f",
    parentName: "Solicitud 0593",
  };
  const m = mentionMessage({
    task,
    authorName: "Noma | Studio Nomade",
    mentions: [slackMention("U1", "Persona"), slackMention(null, "@Otra")],
    body: "hola",
  });
  assert.equal(
    m.mrkdwn,
    "💬 <@U1> *Otra* · *Noma | Studio Nomade* comentó en *Solicitud 0593 › Vector rotulado* · <https://app.asana.com/0/1/2/f|Abrir en Asana>\n> hola",
  );

  const r = reopenedMessage({
    task: { ...task, parentName: null },
    byName: "Persona",
    state: "Con ajustes",
    assignee: "<@U1>",
  });
  assert.equal(
    r.mrkdwn,
    "🔁 Tarea reabierta · *Vector rotulado* por Persona · Estado: *Con ajustes* · <@U1> · <https://app.asana.com/0/1/2/f|Abrir en Asana>",
  );
  const none = reopenedMessage({
    task,
    byName: null,
    state: null,
    assignee: null,
  });
  assert.match(none.mrkdwn, /· _sin responsable_ ·/);
});

test("eventos del vínculo y archivo de seed", () => {
  assert.equal(eventEnabled({ mention: false }, "mention"), false);
  assert.equal(eventEnabled({}, "completed"), true);
  assert.equal(eventEnabled(null, "reopened"), true);
  assert.deepEqual(linkEvents({ events: { completed: true } }).completed, true);
  const file = slackLinksFileSchema.parse({
    links: [
      {
        asana_project_gid: "1200000000000001",
        asana_project_name: "Cliente A | Proyecto",
        slack_channel_id: "C0000000001",
        slack_channel_name: "#proy-cliente_a",
      },
    ],
  });
  assert.equal(file.links[0].slack_channel_name, "proy-cliente_a");
  assert.equal(file.links[0].active, true);
  assert.throws(() =>
    slackLinksFileSchema.parse({
      links: [
        {
          asana_project_gid: "1",
          asana_project_name: "x",
          slack_channel_id: "C1",
          slack_channel_name: "x",
        },
      ],
    }),
  );
});

test("eventos de Estado, asignación y cierre", () => {
  const estado = (from: string | null, to: string) => ({
    resource_subtype: "enum_custom_field_changed",
    custom_field: { name: "Estado" },
    old_enum_value: from ? { name: from } : null,
    new_enum_value: { name: to },
  });
  assert.equal(
    storyEventKind(estado("Aprobado", "Con ajustes")),
    "state_change",
  );
  assert.equal(storyEventKind(estado("Aprobado", "Aprobado")), null);
  // Otro campo enum (Prioridad, Ticket…) no avisa.
  assert.equal(
    storyEventKind({
      ...estado("Alta", "Baja"),
      custom_field: { name: "Prioridad" },
    }),
    null,
  );
  assert.equal(storyEventKind({ resource_subtype: "assigned" }), "assigned");
  assert.equal(
    storyEventKind({ resource_subtype: "marked_complete" }),
    "completed",
  );
  // En proyectos de correo, esos avisos los sigue dando el flujo de correo.
  assert.ok(EMAIL_FLOW_EVENTS.has("state_change"));
  assert.ok(!EMAIL_FLOW_EVENTS.has("mention"));
});

test("mensajes cortos de los eventos nuevos", () => {
  const task = { name: "Pieza", url: "https://app.asana.com/0/1/2/f" };
  assert.equal(
    stateChangeMessage({
      task,
      from: "Aprobado",
      to: "Con ajustes",
      byName: "Persona Uno",
      assignee: "<@U1>",
    }).mrkdwn,
    "🔄 *Pieza* · Estado: Aprobado → *Con ajustes* · por Persona Uno · <@U1> · <https://app.asana.com/0/1/2/f|Abrir en Asana>",
  );
  assert.equal(
    assignedMessage({
      task,
      assignee: "<@U1>",
      byName: null,
      dueOn: "2026-11-25",
    }).mrkdwn,
    "👤 <@U1>, te asignaron *Pieza* · Entrega: *25-11* · <https://app.asana.com/0/1/2/f|Abrir en Asana>",
  );
  assert.equal(
    completedMessage({ task, byName: "Ana" }).mrkdwn,
    "✅ Tarea cerrada · *Pieza* por Ana · <https://app.asana.com/0/1/2/f|Abrir en Asana>",
  );
  assert.equal(
    newTaskMessage({
      task,
      folio: null,
      assignee: null,
      dueOn: null,
      priority: "Alta",
    }).mrkdwn,
    "🆕 *Pieza* · Responsable: _sin responsable_ · Prioridad: *Alta* · <https://app.asana.com/0/1/2/f|Abrir en Asana>",
  );
  assert.equal(groupedBody("a", "b"), "a\nb");
  // El mismo aviso no se repite en el mensaje agrupado.
  assert.equal(groupedBody("a\nb", "b"), "a\nb");
  assert.equal(groupedBody("a", "a\nc"), "a\nc");
});
