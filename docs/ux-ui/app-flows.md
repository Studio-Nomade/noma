# Flujos de la aplicación · Noma

## Flujo principal (pipeline comercial)

```
Nuevo contacto
  → Crear Cliente (datos de contacto e industria)
  → Crear Proyecto (vincular cliente, área, etapa comercial)
  → Completar Brief (general + específico por área)
  → Seleccionar Servicios (biblioteca por área)
  → Generar/redactar Propuesta (IA en fase futura)
  → Revisar y editar secciones
  → Exportar / Copiar
  → Marcar como Enviada (actualiza estado del proyecto)
  → Definir Próxima Acción
  → Actualizar Estado (Aprobada / Rechazada / Negociación)
```

## Login

1. Acceso a Noma → sin sesión → `/login`.
2. Botón "Continuar con Google" (Workspace).
3. Callback intercambia código por sesión → Dashboard.
4. (Opcional) validación de dominio `@studionomade.cl`.

## Crear Cliente

Desde `/clients` → "Nuevo cliente". Obligatorio: nombre de empresa. Estado inicial:
Prospecto. Desde el detalle se crean proyectos vinculados.

## Crear Proyecto

Desde `/projects` o detalle de cliente. Obligatorio: nombre, cliente, área. Estado inicial:
Levantamiento; etapa: Nuevo lead. Incluye próxima acción y links externos.

## Completar Brief

Paso 1 general (objetivo, problema, audiencia, plazo, presupuesto, material).
Paso 2 específico por área (Branding, Web, Arquitectura, Audiovisual, CE, Operaciones).
Guardar borrador o marcar Completado.

## Propuesta

1. Crear desde proyecto/brief.
2. Seleccionar servicios (alimentan alcance/entregables/valor).
3. Definir valor estimado (UF por defecto).
4. Redactar/editar las 12 secciones inline. (Botón "Generar con IA" preparado, inerte en V1.)
5. Copiar al portapapeles / vista imprimible.
6. Cambiar estado: Borrador → En revisión → Enviada → Aprobada/Rechazada. Al marcar Enviada,
   se actualiza el proyecto y se define próxima acción.

## Estados y próxima acción

- **Estado del proyecto** = fase operativa.
- **Etapa comercial** = fase de venta (independiente del estado).
- **Próxima acción** = texto libre, siempre presente en proyectos activos
  (formato: qué + cuándo + quién).

## Uso diario recomendado

- Inicio: revisar dashboard, próximas acciones/entregas vencidas.
- Durante: crear cliente/proyecto al instante; completar brief tras el levantamiento.
- Cierre: actualizar estados y asegurar próxima acción en cada proyecto activo.
