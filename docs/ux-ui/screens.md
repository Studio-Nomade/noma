# Inventario de pantallas · Noma

Referencia visual: capturas del prototipo Base44 (estética sobria a elevar). Todas las
pantallas usan el shell sidebar + contenido.

| Ruta                            | Pantalla                | Elementos clave                                                                                                                |
| ------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/`                             | Dashboard               | 4 MetricCards · próximas acciones · próximas entregas · propuestas recientes/enviadas · briefs en proceso · actividad reciente |
| `/login`                        | Login                   | Logo Noma · botón Google · subtítulo Studio Nomade                                                                             |
| `/clients`                      | Lista de clientes       | Búsqueda · tabla (empresa, contacto, estado) · CTA "Nuevo cliente" (modal)                                                     |
| `/clients/:id`                  | Detalle de cliente      | Datos · estado · proyectos asociados · links · notas                                                                           |
| `/projects`                     | Lista de proyectos      | Filtros por área/estado · tabla (proyecto, cliente, área, etapa, prioridad, próxima acción)                                    |
| `/projects/:id`                 | Detalle de proyecto     | Datos · estado/etapa/prioridad · brief asociado · propuestas · links · próxima acción                                          |
| `/briefs` / `/briefs/:id`       | Briefs                  | Lista + editor por pasos (general + específico por área)                                                                       |
| `/proposals` / `/proposals/:id` | Propuestas              | Lista + editor por secciones · panel de servicios · estado/versión · copiar/imprimir                                           |
| `/services`                     | Biblioteca de servicios | Agrupado por área · card por servicio (precio UF, tiempo) · modal nuevo servicio                                               |
| `/settings`                     | Configuración           | Datos del estudio · equipo interno · plantilla de condiciones                                                                  |
| `/onboarding`                   | Onboarding              | Perfiles de equipo · procesos por área · mapa de herramientas · accesos (referencia)                                           |
| `/context-docs`                 | Contexto/Documentación  | Carga y listado de documentos (categoría, área, tags)                                                                          |
| `/docs`                         | Documentación           | Render de los documentos del proyecto                                                                                          |

## Componentes transversales

- **Sidebar**: logo Noma + "Studio Nomade", navegación, "Cerrar sesión". Link activo
  `bg-foreground text-background`.
- **MetricCard**, **StatusBadge**, **DataTable**, **EmptyState**, modales de creación, formularios
  por pasos.

## Estados

Cada lista define su **estado vacío** (ícono + título + CTA), **carga** (skeleton) y **error**
(mensaje + reintentar).
