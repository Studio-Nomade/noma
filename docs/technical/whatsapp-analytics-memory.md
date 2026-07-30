# Analítica y memoria del agente de WhatsApp

## Fuentes y acceso

`client_requests` es la fuente de verdad de las solicitudes y `bot_messages`
del intercambio conversacional. Las métricas se calculan en servidor dentro
del espacio autenticado del equipo; los agregados no se envían al portal de
clientes.

El índice `client_requests_analytics_idx` cubre el recorrido habitual por
cliente, fecha, alcance y estado. Las conversaciones relacionadas se cargan
con una sola consulta `inArray`, evitando N+1.

## Definiciones

- **Volumen:** solicitudes creadas dentro del rango inclusivo.
- **Adicionales:** solicitudes cuyo alcance vigente es `additional`.
- **Primera respuesta:** minutos entre la creación de la solicitud y el primer
  mensaje posterior del asistente en su conversación.
- **Hasta Asana:** minutos entre la solicitud y el primer intento de
  materialización (`asana_attempted_at`).
- **Precisión de alcance:** predicciones originales que siguen coincidiendo con
  el alcance vigente, sobre solicitudes con `predicted_scope_class`.
- **Corrección:** cambio humano cuyo alcance final difiere de la predicción
  original. Se registra en `scope_corrected_at`.
- **Recurrencia:** volumen agrupado por semana ISO y por mes calendario.
- **Tipo:** clustering determinista por palabras clave. Es explicable, barato y
  no altera el texto ni el alcance de la solicitud.

Los registros anteriores a esta versión pueden no tener predicción original y
se excluyen de la muestra de precisión.

## Memoria corta y larga

- **Memoria corta:** hasta 20 mensajes recientes de la conversación actual. Se
  usa para mantener el hilo y confirmar una solicitud.
- **Memoria larga:** resumen compacto persistido en
  `bot_channels.context_pack.longTermMemory`. Cada 10 mensajes entrantes se
  actualiza con el proveedor LLM, conservando únicamente preferencias, tono,
  formatos, recurrencias y contexto estable explícito.

La actualización es degradable: si OpenAI no está disponible, el mensaje de
WhatsApp se procesa normalmente y el resumen puede reintentarse en un ciclo
posterior. No se guardan precios, secretos ni instrucciones del cliente como
reglas del sistema.

## Decisión sobre embeddings

No se incorpora un vector store en este hito. El volumen actual puede
resolverse con historial relacional, contexto contractual y el resumen
persistente. Se reconsiderará cuando la recuperación por cliente deje de ser
precisa o el histórico supere lo razonable para agregados SQL.
