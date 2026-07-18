# Inventario de assets para propuestas

| Asset                                | Origen actual                              | Destino                                            | Uso                      | Estado                            |
| ------------------------------------ | ------------------------------------------ | -------------------------------------------------- | ------------------------ | --------------------------------- |
| Logo Nomade claro/oscuro             | `context/assets cotizador/Logotipos/`      | `public/assets/brand/nomade-{white,black}.png`     | Header general           | Disponible                        |
| Logos B&D/WD/A&D/A&A                 | `context/assets cotizador/Logotipos/`      | `public/assets/areas/`                             | Header por servicio      | Disponible en blanco/negro        |
| Fotos de equipo (8)                  | `context/assets cotizador/Equipo/`         | `public/assets/team/`                              | Equipo                   | Disponible; fallback por nombre   |
| Portadas B&D/WD/A&D/A&A              | `context/assets cotizador/Láminas/`        | `public/assets/proposals/slides/`                  | Separadores por área     | PNG oficial disponible            |
| Manifiesto fijo                      | `context/assets cotizador/Láminas/`        | `public/assets/proposals/slides/manifesto.*`       | Apertura editorial       | Disponible                        |
| Información bancaria                 | Referencia visual entregada                | Componente React/PDF                               | Datos bancarios/contacto | Editable y con enlaces activos    |
| Carta Gantt                          | `context/assets cotizador/Carta Gantt.svg` | `public/assets/proposals/slides/gantt-reference.*` | Referencia de cronograma | Disponible                        |
| Cook Gothif Bold                     | `context/assets cotizador/Gothif/`         | `public/assets/fonts/`                             | Títulos                  | TTF y WOFF2 incorporados          |
| San Diego Medium/SemiBold            | `context/assets cotizador/San Diego/`      | `public/assets/fonts/`                             | Texto                    | TTF y WOFF incorporados           |
| Maestro de slides (15)               | `data/raw/SVG/ARCHIVO MAESTRO NOMADE/`     | Referencia                                         | Layout/paleta            | Disponible                        |
| Deck Punta Volcanes (8)              | `data/raw/SVG/WD_N260623.../`              | Referencia                                         | Layout Web               | Disponible                        |
| Logos/portadas CE, MP, SN, CSM y STR | no incluidos                               | `public/assets/areas/`                             | Áreas restantes          | Falta                             |
| Tipografía manuscrita                | no incluida                                | `public/assets/fonts/`                             | Acentos futuros          | Pendiente si se requiere editable |
