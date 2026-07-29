import { config } from "dotenv";

config({ path: ".env.local" });

import { importPrivatePlanOfAccounts } from "@/features/finance/plan-accounts/import-private";

async function main() {
  const result = await importPrivatePlanOfAccounts();
  if (!result) {
    throw new Error(
      "No se encontró plan_de_cuentas en NOMA_DATA_DIR. Usa JSON, CSV o XLSX.",
    );
  }
  console.log(
    `Importadas ${result.accounts} cuentas desde ${result.path}; ${result.linkedServices} servicios vinculados.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("✗ Error importando plan de cuentas:", error);
  process.exit(1);
});
