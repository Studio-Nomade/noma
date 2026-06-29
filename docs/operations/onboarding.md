# Onboarding interno · Noma

Módulo para incorporar nuevos colaboradores y documentar el funcionamiento del estudio.

## Perfil de colaborador (`team_members`)

- Nombre, rol dentro del estudio, área principal, email, estado.
- **Herramientas** que debe usar (`tools`).
- **Accesos requeridos** (`access_references`): se documentan como **referencia a un gestor de
  contraseñas** (p. ej. "1Password · vault Studio Nomade · ítem Asana"), **nunca** la
  contraseña en texto plano.
- Repositorios relevantes (`repos`), notas.

## Documentación operativa (`knowledge_docs`)

- Procesos internos por área.
- Buenas prácticas.
- Guías de uso de herramientas.
- Material de onboarding (categoría `onboarding`).

## Seguridad de accesos

- Prohibido almacenar secretos en claro.
- Se referencia un gestor externo (a definir: 1Password / Bitwarden).
- Si en el futuro se requiere guardar secretos, debe usarse cifrado y campos protegidos
  (decisión y ADR específico antes de implementarlo).

## Checklist de incorporación (sugerido)

1. Crear perfil en Noma (rol, área, herramientas).
2. Registrar accesos requeridos como referencias al gestor.
3. Compartir procesos del área (`knowledge_docs`).
4. Recorrer el flujo principal (cliente → proyecto → brief → propuesta).
5. Revisar el mapa de herramientas ([tools-map.md](tools-map.md)).
