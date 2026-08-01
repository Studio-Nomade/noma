# Email Studio

Email Studio transforma un diseño de correo aprobado en Canva en un blueprint
editable y en HTML compatible con clientes de correo. Noma prepara, aloja y
exporta el desarrollo; el envío de campañas permanece fuera del módulo.

## Flujo de producto

1. Se crea un desarrollo asociado a un cliente y, opcionalmente, a un proyecto
   de Noma.
2. Se adjunta la referencia aprobada completa en PNG, JPG, WEBP o PDF. Esta
   referencia se conserva en un bucket privado y solo se expone mediante una URL
   firmada temporal.
3. Se adjuntan los assets independientes. Sharp reduce imágenes a un máximo de
   1400 px, conserva transparencia cuando corresponde y comprime PNG/JPEG antes
   de publicarlos.
4. Cada asset crea un bloque ordenado. Desde Estructura se definen zonas
   clickeables, enlaces HTTPS, `mailto:` o `tel:`, textos alternativos, textos,
   botones, espacios y variables `{{clave}}`.
5. Se genera el blueprint. Si hay referencia y `OPENAI_API_KEY`, el sistema puede
   proponer una estructura con visión; la salida se valida con Zod. La
   compilación manual siempre está disponible y también funciona como fallback.
6. El preview se revisa en ancho desktop o móvil junto con el audit automático.
7. Se descarga el HTML autocontenido y el blueprint JSON para entregar al
   cliente o importar en su plataforma.

## Hitos implementados

- **Hito 0 — contrato y compilador:** `EmailDocument 1.0`, Zod, MJML 5 y
  laboratorio técnico.
- **Hito 1 — proyectos:** hub, asociación a cliente/proyecto y archivado
  reversible.
- **Hito 2 — carga:** referencia privada, assets públicos, validaciones y
  optimización.
- **Hito 3 — estructura:** orden, textos editables, botones reales, enlaces,
  texto alternativo, variables y configuración visual.
- **Hito 4 — generación:** planificación visual opcional con OpenAI Responses
  API, salida estructurada y fallback determinista.
- **Hito 5 — plantillas:** biblioteca por cliente ligada a assets versionados;
  reemplazar el archivo actualiza los usos editables sin alterar entregas previas.
- **Hito 6 — preview y QA:** visor responsive, HTML/MJML, validación de peso,
  HTTPS, textos alternativos y variables, más advertencia de Outlook.
- **Hito 7 — exportación:** descargas autenticadas de `.html` y `.json`.
- **Endurecimiento posterior:** contenido escapado, exportación solo de la
  versión vigente, proyectos archivados en lectura, historial recuperable,
  telemetría de IA y operaciones compensadas entre Postgres y Storage.

## Decisiones de compatibilidad

- El email final usa tablas generadas por MJML y CSS inline. No se trasladan
  superposiciones HTML absolutas desde Canva porque Outlook de escritorio no las
  interpreta de forma fiable.
- Las composiciones gráficas complejas se conservan como imágenes; texto,
  botones y variables se separan cuando necesitan edición, personalización o
  accesibilidad.
- Cada bloque clickeable usa un enlace real. Un texto completo también puede
  enlazar a web, email, teléfono o a una variable.
- Los assets exportables deben usar HTTPS público. La referencia completa nunca
  se incluye en el HTML.
- Se usan fuentes de sistema. Cualquier fondo o tipografía especial requiere una
  prueba adicional en los clientes objetivo.
- El audit señala HTML sobre 102 KB por el riesgo de clipping en Gmail y deja
  una revisión manual obligatoria para Outlook de escritorio.

## Almacenamiento

| Bucket                 | Acceso  | Contenido                                   |
| ---------------------- | ------- | ------------------------------------------- |
| `email-studio-sources` | Privado | Referencias completas PNG/PDF aprobadas     |
| `email-studio-assets`  | Público | Imágenes optimizadas consumidas por el HTML |

Los paths incorporan cliente, proyecto e ID aleatorio. Cada reemplazo crea un
objeto y una URL nuevos con cache prolongado; el objeto anterior se conserva
para que un HTML ya entregado no cambie silenciosamente. Retirar un asset lo
archiva en base de datos en vez de borrar el objeto público. Los nombres
originales se guardan como metadata y no forman parte de la URL pública. Los
archivos de clientes no se versionan en el repositorio.

## IA y degradación

La llamada usa `OPENAI_API_KEY` exclusivamente server-side y el modelo
`EMAIL_STUDIO_OPENAI_MODEL` (default `gpt-5.6`). PNG/JPG/WEBP se envían como
imágenes y PDF como archivo con imágenes de página. La respuesta usa Structured
Outputs, se valida otra vez con Zod y se solicita con `store: false`.

Si falta la llave, la referencia o una respuesta válida, el editor no pierde
datos: muestra una advertencia y compila la estructura manual configurada.
Antes de aplicar un plan asistido, el sistema construye y compila el candidato
en memoria. Cada intento registra estado, modelo, duración y tokens, nunca el
prompt ni la respuesta. El límite por usuario se configura con
`EMAIL_STUDIO_AI_MAX_RUNS_PER_HOUR` y se serializa en Postgres para evitar
carreras concurrentes.

## Versiones y exportación

Cada generación guarda un snapshot del editor y del blueprint. Antes de una
generación asistida o de recuperar una revisión se crea además un checkpoint.
Recuperar no sobrescribe el historial: materializa una versión nueva y conserva
el estado desplazado. Si settings, elementos, variables o assets cambian después
de generar, preview y HTML muestran la advertencia y las rutas de descarga
responden `409` hasta volver a compilar.

## Verificación

```bash
npm run email-studio:check
npm run typecheck
npm run lint
```

Después de una migración se reinicia el servidor y se valida el flujo principal
en `http://localhost:3001/email-studio`: crear proyecto, cargar referencia y
asset, editar enlace/variable, generar, revisar preview y descargar.
