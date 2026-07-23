"use client";

import { useState } from "react";
import { createImportDraft } from "./import-actions";

type Template = { id: string; name: string; type: string };
type Account = { id: string; bank: string; name: string };

const TYPES = [
  { value: "NUBOX_VENTAS", label: "Nubox · Registro de Ventas" },
  { value: "NUBOX_COMPRAS", label: "Nubox · Registro de Compras" },
  { value: "CARTOLA_BANCARIA", label: "Cartola bancaria (BCI)" },
];

export function ImportForm({
  templates,
  accounts,
}: {
  templates: Template[];
  accounts: Account[];
}) {
  const [type, setType] = useState("NUBOX_VENTAS");
  const [pending, setPending] = useState(false);
  const isCartola = type === "CARTOLA_BANCARIA";
  const relevantTemplates = templates.filter((t) => t.type === type);

  return (
    <form
      action={createImportDraft}
      onSubmit={() => setPending(true)}
      className="glass space-y-4 rounded-xl p-5"
    >
      <div>
        <label className="mb-1 block text-sm font-medium">
          Tipo de importación
        </label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {isCartola && (
        <div>
          <label className="mb-1 block text-sm font-medium">
            Cuenta bancaria
          </label>
          <select
            name="bankAccountId"
            required
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bank} · {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {relevantTemplates.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">
            Plantilla de columnas (opcional)
          </label>
          <select
            name="templateId"
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Mapeo por defecto</option>
            {relevantTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">
          Archivo (.csv, .xlsx)
        </label>
        <input
          type="file"
          name="file"
          accept=".csv,.xlsx,.xlsm"
          required
          className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Procesando…" : "Previsualizar importación"}
      </button>
    </form>
  );
}
