import { config } from "dotenv";
config({ path: ".env.local" });

import { syncRates } from "@/lib/currency/rates";

async function main() {
  const rates = await syncRates();
  console.log(
    `✓ Tasas ${rates.date} sincronizadas — UF: ${rates.ufClp} CLP · USD: ${rates.usdClp} CLP`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error sincronizando tasas:", err);
  process.exit(1);
});
