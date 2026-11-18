# Instrucción para Claude Code (arquitecto) · Seguimiento en Noma

Copiar al proyecto local del arquitecto (por ejemplo como skill `noma-seguimiento` o en su `CLAUDE.md`). Reemplaza la edición de `seguimiento/datos.js`: el tablero vive en Noma.

## Variables (en la máquina del arquitecto, nunca en el repo)

```
NOMA_URL=https://<despliegue>
NOMA_DEV_TRACKING_TOKEN=<DEV_TRACKING_API_TOKEN>
NOMA_PROGRAM_ID=<id de dev_programs del programa>
```

## Al abrir una sesión

1. Contexto: `GET $NOMA_URL/api/dev-tracking/$NOMA_PROGRAM_ID/modulos` (módulos, hitos, pelota, preguntas abiertas, siguiente código).
2. Paquetes pendientes: `GET …/paquetes?estado=armado` y, por cada uno, `GET …/paquetes/<code>` (YAML). Guardar una copia en `Local/roadmaps/_entrada/<code>.yaml`.
3. Verificar cada solicitud contra el código y los datos (solo lectura) y decidir el veredicto: `ya_existe` · `bug` · `requiere_desarrollo` · `bloqueada`.
4. **Organizar** las solicitudes: el arquitecto decide en qué roadmap (`R##`), módulo (`NDes-###`) o en ninguno va cada una, y en qué hito. Para un roadmap nuevo: `POST …/siguiente-roadmap {"tipo":"mejora"|"correccion"|"modulo"}` y usar el código devuelto para la carpeta, la rama (`feat/r75-h1-slug`) y el PR (`Roadmap: R75 · H1`, `Asana: <gid>`).
5. **Publicar** el plan en Noma (`POST …/resultados`, abajo). Con eso Noma crea las tareas en Asana (`R76 · título`); no crearlas a mano.
6. **Con cada merge y deploy** aprobado: `POST …/resultados` con `paquete` y `solicitudes:[{id, estado}]` (`en_desarrollo` · `en_qa` · `con_ajustes` · `cerrado`). Noma cambia Estado y sección de esas tareas en Asana.

## Al cerrar la sesión

`POST …/resultados` con JSON:

```json
{
  "paquete": "PKG-2026-11-18-01",
  "roadmap": { "codigo": "R75", "titulo": "…", "tipo": "mejora", "estado": "pendiente" },
  "solicitudes": [
    { "id": "CO-01", "veredicto": "requiere_desarrollo", "hito": "H2" },
    { "id": "CO-02", "veredicto": "ya_existe", "nota": "Es configuración: …" },
    { "id": "BO-05", "veredicto": "requiere_desarrollo", "roadmap": "NDes-006" },
    { "id": "GE-01", "veredicto": "requiere_desarrollo", "roadmap": null, "nota": "Más adelante" }
  ],
  "preguntas_nuevas": [{ "pregunta": "…", "para": "Rodrigo Godoy", "bloquea": "R75 H5" }],
  "modulos": [
    {
      "codigo": "NDes-006",
      "avance": 55,
      "pelota": { "quien": "Jaime", "que": "CSV real del banco" },
      "proximo_seguimiento": "2026-11-20",
      "hitos": [{ "nombre": "H5 Ensayo e ingesta", "estado": "pr_abierto", "prs": ["appscinco-backend#503"] }]
    }
  ],
  "bitacora": [{ "modulo": "NDes-006", "texto": "…" }],
  "desplegado": [{ "repo": "appscinco-lambda", "numero": 14, "titulo": "…", "roadmap": "R74" }]
}
```

Por solicitud: `roadmap` es su código (`"NDes-006"`), `null` si no va en ningún roadmap, u omitido para usar el `roadmap` principal; `hito` y `estado` son opcionales. Otros roadmaps nuevos de la misma sesión van en `roadmaps: [{codigo, titulo, tipo}]`. Las actualizaciones posteriores llevan solo `id` y `estado` (y `paquete`, para ubicar la solicitud: los códigos como `OP-01` se repiten entre reuniones).

Reglas: estados de hito `en_prod · pr_abierto · en_desarrollo · pendiente · bloqueado`; `en_prod` solo con `main` desplegado y verificado. Mientras no exista la integración con GitHub (F2), informa en `desplegado` todos los PR que llegaron a producción (back, web, APK y Lambda). Un roadmap de mejora o corrección (`R##`) no necesita módulo: va solo en `roadmap`; los módulos son los desarrollos de varios hitos (`NDes-###`, `TELEMETRIA`, `COT-FACT`) y sus nombres deben coincidir exactamente con los de `/modulos`. Si publicas un `roadmap` con un código que no reservaste, Noma avanza el contador igual. Una línea de bitácora rápida va por `POST …/bitacora {"modulo":"…","texto":"…"}`.

Todo con `Authorization: Bearer $NOMA_DEV_TRACKING_TOKEN` y `Content-Type: application/json`.
