# Fricciones operativas y cómo Noma las reduce

Noma debe **reducir** fricción, no solo replicar procesos.

| Fricción actual                        | Síntoma                           | Cómo lo aborda Noma                                                            |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| Venta sin pipeline visible             | Se pierde el seguimiento          | Estado operativo + etapa comercial + **próxima acción** obligatoria; dashboard |
| Briefs sin estructura                  | Propuestas incompletas, reproceso | Formulario por área con campos generales + específicos (JSON)                  |
| Propuestas desde cero                  | Tiempo y calidad inconsistente    | Biblioteca de servicios → alcance/entregables/valor; (IA en fase futura)       |
| Carpetas Drive dispersas               | No se encuentran los archivos     | `resource_links` centraliza enlaces por cliente/proyecto                       |
| Presupuestos/SLA/plantillas repartidos | Procesos no estandarizados        | Módulo **Contexto/Documentación** (carga y estructura documentos)              |
| Precios indexados a inflación          | Cotizaciones desactualizadas      | Cobro en **UF** + conversor diario                                             |
| Cliente→proyecto→entregables difuso    | Falta trazabilidad                | Relaciones explícitas en el modelo de datos                                    |
| Asana/Slack/Canva sueltos              | Contexto fragmentado              | Links tipados por proyecto; avance desde Asana (V2)                            |
| Onboarding lento                       | Cada incorporación reinventa      | Perfiles + procesos + mapa de herramientas + accesos por referencia            |
| Próximas acciones que se pierden       | Olvidos de seguimiento            | Campo de primera clase + recordatorios (v1.1)                                  |
| Transición a portal cliente            | Reescribir todo después           | Arquitectura preparada (RLS por cliente, login email/clave, avance Asana)      |

## Recomendaciones de proceso

- **Una sola fuente de verdad:** evitar duplicar información entre Noma y otros sistemas.
- **Estandarizar la biblioteca de servicios** con precios reales en UF antes de masificar el uso.
- **Definir el set de preguntas de brief por área** con los líderes de cada disciplina.
- **Elegir el gestor de contraseñas** de referencia para onboarding (1Password/Bitwarden).
- **Convención de carpetas Drive** documentada y enlazada desde cada proyecto.
