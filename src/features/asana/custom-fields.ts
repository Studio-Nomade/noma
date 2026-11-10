/**
 * Resolución de campos personalizados de Asana por nombre (p. ej. "Estado" →
 * "Enviado a cliente"), tolerante a tildes, mayúsculas y espacios.
 * Módulo puro: recibe los custom_field_settings ya descargados.
 */

export type AsanaEnumOption = { gid: string; name: string; enabled?: boolean };
export type AsanaCustomField = {
  gid: string;
  name: string;
  resource_subtype?: string; // enum | text | number | date | multi_enum | people
  enum_options?: AsanaEnumOption[];
};
export type AsanaCustomFieldSetting = { custom_field: AsanaCustomField };

export function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactName(value: string) {
  return foldName(value).replace(/[^a-z0-9]/g, "");
}

export function findCustomField(
  settings: AsanaCustomFieldSetting[],
  fieldName: string,
): AsanaCustomField | null {
  const wanted = foldName(fieldName);
  return (
    settings.find((setting) => foldName(setting.custom_field.name) === wanted)
      ?.custom_field ?? null
  );
}

/**
 * gid del campo enum y de la opción buscada; null si el campo no existe, no
 * es enum o la opción no existe/está deshabilitada.
 */
export function findEnumOption(
  settings: AsanaCustomFieldSetting[],
  fieldName: string,
  optionNames: string | string[],
): { fieldGid: string; optionGid: string; optionName: string } | null {
  const field = findCustomField(settings, fieldName);
  if (!field || (field.resource_subtype && field.resource_subtype !== "enum")) {
    return null;
  }
  for (const optionName of [optionNames].flat()) {
    const wanted = foldName(optionName);
    const option = field.enum_options?.find(
      (candidate) =>
        candidate.enabled !== false && foldName(candidate.name) === wanted,
    );
    if (option) {
      return {
        fieldGid: field.gid,
        optionGid: option.gid,
        optionName: option.name,
      };
    }
  }
  return null;
}

/** Valor deseado para un campo personalizado, por nombre. */
export type CustomFieldWish =
  /** Enum: primera opción que exista (en orden de preferencia). */
  | { kind: "enum"; fields: string[]; options: string[] }
  /** Multi-enum: todas las opciones que existan (ignora las que no). */
  | { kind: "multi_enum"; fields: string[]; options: string[] }
  /** Texto libre. */
  | { kind: "text"; fields: string[]; value: string };

export type CustomFieldValues = Record<string, string | string[]>;

/**
 * Traduce deseos por nombre a `custom_fields` de Asana ({gid campo → valor}).
 * Cada deseo prueba sus nombres de campo en orden y usa el primero que exista
 * con el tipo correcto. Lo que no calza se omite: nunca crea opciones ni
 * escribe en un campo de otro tipo.
 */
export function buildCustomFieldValues(
  settings: AsanaCustomFieldSetting[],
  wishes: CustomFieldWish[],
): CustomFieldValues {
  const values: CustomFieldValues = {};
  for (const wish of wishes) {
    for (const fieldName of wish.fields) {
      const field = findCustomField(settings, fieldName);
      if (!field || values[field.gid] !== undefined) continue;
      const subtype = field.resource_subtype ?? "enum";
      if (wish.kind === "text") {
        if (subtype !== "text" || !wish.value.trim()) continue;
        values[field.gid] = wish.value.trim().slice(0, 1_000);
        break;
      }
      if (subtype !== wish.kind) continue;
      const options = (field.enum_options ?? []).filter(
        (option) => option.enabled !== false,
      );
      const matched = wish.options
        .map(
          (wanted) =>
            options.find(
              (option) => foldName(option.name) === foldName(wanted),
            ) ??
            // "MarcaB Group" ≈ "Marca B Group": sin espacios ni signos.
            options.find(
              (option) => compactName(option.name) === compactName(wanted),
            ),
        )
        .filter((option): option is AsanaEnumOption => Boolean(option));
      if (!matched.length) continue;
      values[field.gid] =
        wish.kind === "enum"
          ? matched[0].gid
          : [...new Set(matched.map((option) => option.gid))];
      break;
    }
  }
  return values;
}
