import type { EmailDocument } from "./document";

/**
 * Fixture público y deliberadamente genérico.
 *
 * Replica la estructura técnica del correo usado para validar el Hito 0
 * (cabecera, tarjeta, contenido dinámico, CTA, legal y footer), sin copiar
 * marcas, textos ni assets reales de clientes al repositorio desplegable.
 */
export const emailStudioPrototype: EmailDocument = {
  version: "1.0",
  id: "alerta-financiera-spike",
  name: "Alerta financiera · Spike",
  subject: "Nueva actualización disponible en tu reporte",
  previewText: "Revisa la información nueva en tu reporte financiero.",
  language: "es",
  width: 700,
  theme: {
    canvasColor: "#efefec",
    topBandColor: "#213b36",
    topBandHeight: 54,
    textColor: "#4d5552",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  assets: [
    {
      id: "client-logo",
      label: "Logo de demostración",
      path: "/assets/brand/nomade-black.png",
      alt: "Marca de demostración",
      width: 210,
    },
    {
      id: "footer-lockup",
      label: "Lockup de demostración",
      path: "/assets/brand/nomade-black.png",
      alt: "Marca de demostración",
      width: 190,
    },
    {
      id: "social-one",
      label: "Canal uno",
      path: "/assets/areas/bd-black.png",
      alt: "Canal uno",
      width: 28,
    },
    {
      id: "social-two",
      label: "Canal dos",
      path: "/assets/areas/wd-black.png",
      alt: "Canal dos",
      width: 28,
    },
    {
      id: "social-three",
      label: "Canal tres",
      path: "/assets/areas/aa-black.png",
      alt: "Canal tres",
      width: 28,
    },
  ],
  variables: [
    {
      key: "nombre_apellido",
      label: "Nombre y apellido",
      sample: "María González",
      required: true,
    },
    {
      key: "reporte_url",
      label: "Enlace al reporte",
      sample: "https://cliente.example/reporte",
      required: true,
    },
    {
      key: "instagram_url",
      label: "Instagram",
      sample: "https://instagram.com/example",
      required: true,
    },
    {
      key: "linkedin_url",
      label: "LinkedIn",
      sample: "https://linkedin.com/company/example",
      required: true,
    },
    {
      key: "web_url",
      label: "Sitio web",
      sample: "https://cliente.example",
      required: true,
    },
  ],
  sections: [
    {
      id: "main-card",
      type: "card",
      label: "Contenido principal",
      backgroundColor: "#ffffff",
      borderRadius: 18,
      outerPadding: 25,
      blocks: [
        {
          id: "logo",
          type: "image",
          assetId: "client-logo",
          width: 210,
          padding: "34px 24px 26px",
          align: "center",
        },
        {
          id: "eyebrow",
          type: "eyebrow",
          content: "ACTUALIZACIÓN DE INFORMACIÓN",
          color: "#63706c",
          padding: "0px 42px",
          align: "center",
        },
        {
          id: "heading",
          type: "heading",
          content: "Revisa las novedades<br/>de tu reporte.",
          color: "#35403d",
          fontSize: 34,
          lineHeight: 40,
          padding: "8px 42px 0px",
          align: "center",
        },
        {
          id: "greeting",
          type: "text",
          content: "¡Hola, {{nombre_apellido}}!",
          color: "#4d5552",
          fontSize: 20,
          lineHeight: 31,
          padding: "34px 48px 0px",
          align: "left",
        },
        {
          id: "body-one",
          type: "text",
          content:
            "Recibes este correo porque registramos <strong>una actualización relevante en tu información.</strong> Revisarla oportunamente te permitirá actuar a tiempo.",
          color: "#4d5552",
          fontSize: 20,
          lineHeight: 31,
          padding: "22px 48px 0px",
          align: "left",
        },
        {
          id: "body-two",
          type: "text",
          content:
            "Consulta el reporte completo para conocer el detalle de la información publicada.",
          color: "#4d5552",
          fontSize: 20,
          lineHeight: 31,
          padding: "22px 48px 0px",
          align: "left",
        },
        {
          id: "cta",
          type: "button",
          label: "Revisar reporte completo",
          href: "{{reporte_url}}",
          backgroundColor: "#213b36",
          color: "#ffffff",
          borderRadius: 6,
          padding: "24px 48px 0px",
          align: "center",
        },
        {
          id: "reminder",
          type: "text",
          content:
            "<strong>Recuerda:</strong><br/>Monitorear tu información ayuda a detectar cambios relevantes y tomar mejores decisiones.",
          color: "#4d5552",
          fontSize: 14,
          lineHeight: 21,
          padding: "34px 48px 38px",
          align: "left",
        },
      ],
    },
    {
      id: "legal",
      type: "legal",
      label: "Nota legal",
      content:
        "Este mensaje contiene información de carácter confidencial y está destinado exclusivamente a su destinatario.",
      color: "#626966",
    },
    {
      id: "footer",
      type: "footer",
      label: "Footer de demostración",
      logoAssetId: "footer-lockup",
      logoWidth: 190,
      links: [
        {
          label: "Instagram",
          href: "{{instagram_url}}",
          assetId: "social-one",
        },
        {
          label: "LinkedIn",
          href: "{{linkedin_url}}",
          assetId: "social-two",
        },
        {
          label: "Sitio web",
          href: "{{web_url}}",
          assetId: "social-three",
        },
      ],
    },
  ],
};
