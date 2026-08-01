import "./freshness.test";
import "./project.test";
import { runCompilerTests } from "./compiler.test";
import { runDocumentBuilderTests } from "./document-builder.test";

async function main() {
  await runCompilerTests();
  await runDocumentBuilderTests();
  console.log(
    "Email Studio Hitos 0–7: contrato, generación, compilación y proyectos OK",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
