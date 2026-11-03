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
