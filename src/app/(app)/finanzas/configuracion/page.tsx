import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import {
  getBankAccounts,
  getClassificationRules,
  getClassificationOptions,
} from "@/features/finance/queries";
import {
  createBankAccount,
  deleteBankAccount,
  createClassificationRule,
  deleteClassificationRule,
  toggleClassificationRule,
  applyRulesToUnclassified,
} from "@/features/finance/config-actions";

const FIELD_LABELS: Record<string, string> = {
  CONTACTO: "Nombre contacto",
  RUT: "RUT",
  GLOSA: "Glosa",
  MONTO: "Monto",
};

export default async function ConfiguracionPage() {
  const [accounts, rules, options] = await Promise.all([
    getBankAccounts(),
    getClassificationRules(),
    getClassificationOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Cuentas bancarias y reglas de clasificación automática"
      />

      {/* ── Cuentas bancarias ── */}
      <section className="mb-10">
        <h2 className="font-heading mb-3 text-base font-medium">
          Cuentas bancarias
        </h2>
        <div className="border-border bg-card mb-4 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="px-4 py-3">Banco</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">N.º</th>
                <th className="px-4 py-3">Moneda</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-border/60 border-b">
                  <td className="px-4 py-3">{a.bank}</td>
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {a.number ?? "—"}
                  </td>
                  <td className="px-4 py-3">{a.currency}</td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(a.saldo, "CLP")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteBankAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="text-muted-foreground hover:text-[var(--status-red)] text-xs"
                      >
                        Eliminar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          action={createBankAccount}
          className="border-border bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4"
        >
          <Field name="bank" label="Banco" placeholder="BCI" required />
          <Field name="name" label="Nombre" placeholder="Cuenta Corriente" required />
          <Field name="number" label="N.º cuenta" placeholder="89784081" />
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">
              Moneda
            </label>
            <select
              name="currency"
              defaultValue="CLP"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="UF">UF</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium"
          >
            Agregar cuenta
          </button>
        </form>
      </section>

      {/* ── Reglas de clasificación ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-medium">
            Reglas de clasificación
          </h2>
          <form action={applyRulesToUnclassified}>
            <button
              type="submit"
              className="border-border rounded-md border px-3 py-2 text-sm"
            >
              Aplicar reglas a documentos sin clasificar
            </button>
          </form>
        </div>

        <div className="border-border bg-card mb-4 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Regla</th>
                <th className="px-4 py-3">Condición</th>
                <th className="px-4 py-3">Asigna</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    Sin reglas. Crea una abajo para clasificar automáticamente.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="border-border/60 border-b">
                    <td className="px-4 py-3 tabular-nums">{r.priority}</td>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {FIELD_LABELS[r.matchField]} {r.matchOperator} “
                      {r.matchValue}”
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {[r.ledgerName, r.lineName, r.centerName]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={r.isActive ? "Activo" : "Inactivo"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3">
                        <form action={toggleClassificationRule}>
                          <input type="hidden" name="id" value={r.id} />
                          <input
                            type="hidden"
                            name="isActive"
                            value={String(r.isActive)}
                          />
                          <button
                            type="submit"
                            className="text-muted-foreground hover:text-foreground text-xs"
                          >
                            {r.isActive ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                        <form action={deleteClassificationRule}>
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-muted-foreground hover:text-[var(--status-red)] text-xs"
                          >
                            Eliminar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form
          action={createClassificationRule}
          className="border-border bg-card grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field name="name" label="Nombre de la regla" placeholder="Arriendo oficina" required />
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">
              Campo
            </label>
            <select
              name="matchField"
              className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="CONTACTO">Nombre contacto</option>
              <option value="RUT">RUT</option>
              <option value="GLOSA">Glosa</option>
              <option value="MONTO">Monto</option>
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">
              Operador
            </label>
            <select
              name="matchOperator"
              className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="equals">igual a</option>
              <option value="contains">contiene</option>
              <option value="gte">≥ (monto)</option>
              <option value="lte">≤ (monto)</option>
            </select>
          </div>
          <Field name="matchValue" label="Valor" placeholder="inmobiliaria" required />
          <SelectField name="ledgerAccountId" label="Cuenta contable">
            {options.ledgers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} · {o.name}
              </option>
            ))}
          </SelectField>
          <SelectField name="businessLineId" label="Línea de negocio">
            {options.lines.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </SelectField>
          <SelectField name="costCenterId" label="Centro de costo">
            {options.centers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </SelectField>
          <Field
            name="priority"
            label="Prioridad (menor = antes)"
            placeholder="100"
            type="number"
          />
          <div className="flex items-end">
            <button
              type="submit"
              className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium"
            >
              Crear regla
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="text-muted-foreground mb-1 block text-xs">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
      />
    </div>
  );
}

function SelectField({
  name,
  label,
  children,
}: {
  name: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-muted-foreground mb-1 block text-xs">{label}</label>
      <select
        name={name}
        defaultValue=""
        className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        <option value="">(ninguna)</option>
        {children}
      </select>
    </div>
  );
}
