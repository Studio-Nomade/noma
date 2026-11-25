/**
 * Modelo B (proyectos generales de área): asunto con la nomenclatura del área,
 * `ÁREA - Cliente | Solicitud - Entrega NN`. Módulo puro.
 */

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** «DISEÑO IDENTIDAD PINGÜINO» → «Diseño identidad pingüino». */
function sentenceCase(value: string) {
  const letters = value.replace(/[^\p{L}]/gu, "");
  if (!letters || letters !== letters.toUpperCase()) return value;
  const lower = value.toLocaleLowerCase("es-CL");
  return lower.charAt(0).toLocaleUpperCase("es-CL") + lower.slice(1);
}

/**
 * Cliente y solicitud de una tarea de área: el campo «Cliente» si viene; si
 * no, lo que va antes de «|» en el nombre. La solicitud es el resto del
 * nombre (sin folio entre corchetes ni el cliente repetido).
 */
export function areaClientAndRequest(
  taskName: string,
  clientField?: string | null,
): { client: string | null; request: string } {
  const name = clean(taskName).replace(/^\[[^\]]+\]\s*/, "");
  const [head, ...rest] = name.split("|").map(clean);
  const fromName = rest.length ? head : null;
  let request = rest.length ? rest.join(" | ") : name;
  const client = clean(clientField) || fromName || null;
  if (client && !rest.length) {
    // «DISEÑO IDENTIDAD PINGÜINO» con Cliente = «Pinguino»: se quita el
    // nombre del cliente del final o del inicio para no repetirlo.
    const fold = (value: string) =>
      value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const foldedClient = fold(client);
    const words = request.split(" ");
    const foldedWords = words.map(fold);
    const clientWords = foldedClient.split(" ");
    const n = clientWords.length;
    if (foldedWords.slice(-n).join(" ") === foldedClient && words.length > n) {
      request = words.slice(0, -n).join(" ");
    } else if (
      foldedWords.slice(0, n).join(" ") === foldedClient &&
      words.length > n
    ) {
      request = words.slice(n).join(" ");
    }
  }
  return {
    client: client ? sentenceCaseName(client) : null,
    request: sentenceCase(clean(request.replace(/^[-–—:·]\s*/, ""))),
  };
}

/** Nombre del cliente: respeta mayúsculas mixtas; «ACME» → «Acme». */
function sentenceCaseName(value: string) {
  const letters = value.replace(/[^\p{L}]/gu, "");
  if (!letters) return value;
  const isUpper = letters === letters.toUpperCase();
  const isLower = letters === letters.toLowerCase();
  if (!isUpper && !isLower) return value;
  return value
    .toLocaleLowerCase("es-CL")
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, sep: string, char: string) => sep + char.toLocaleUpperCase("es-CL"),
    );
}

/** «CE - Pinguino | Diseño identidad» (sin la parte de entrega). */
export function areaSubjectBase(
  areaCode: string,
  client: string | null,
  request: string,
) {
  return client
    ? `${areaCode} - ${client} | ${request}`
    : `${areaCode} - ${request}`;
}

/** Asunto de una entrega: base + « - Entrega NN». */
export function areaDeliverySubject(base: string, round: number) {
  return `${base} - Entrega ${String(round).padStart(2, "0")}`;
}

/** «Re: X» sin duplicar el prefijo. */
export function areaReplySubject(subject: string) {
  return /^re:/i.test(subject.trim())
    ? subject.trim()
    : `Re: ${subject.trim()}`;
}

/** Asunto normalizado para comparar hilos (sin «Re:»/«RV:» ni espacios). */
export function normalizeThreadSubject(subject: string) {
  return subject
    .replace(/^\s*((re|rv|fw|fwd)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
