# Exportación PDF

El endpoint existente construye el mismo `ProposalTemplateData` que usa el preview y lo entrega a `@react-pdf/renderer`. Cada módulo es una página de 960x540 puntos (16:9); el PDF deja de ser A4 plano.

La exportación se usa también al enviar la propuesta por correo y en el correo de kickoff, sin cambiar esas acciones. El nombre de archivo existente se conserva.

QA recomendado: exportar una propuesta representativa por área, renderizar con `pdftoppm -png`, revisar recortes/solapes y comparar portada, servicios, equipo, inversión y cierre con el preview.
