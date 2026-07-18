/**
 * Generador de firma de correo en HTML. Combina los datos personales del
 * colaborador con la marca del estudio (logo animado + redes, compartidos).
 *
 * El HTML usa tablas y estilos inline: es lo único que respetan de forma
 * consistente los clientes de correo (Gmail, Outlook, Apple Mail). El logo es
 * un GIF alojado en una URL pública (los clientes de correo no cargan archivos
 * adjuntos ni enlaces firmados que expiran).
 */

export type StudioBrand = {
  // GIF animado del logo, alojado en el bucket público `brand`. Vacío = sin logo.
  logoUrl: string;
  instagram?: string;
  website?: string;
  linkedin?: string;
  behance?: string;
};

// Marca del estudio para la firma. El logo vive en el bucket público `brand`.
export const STUDIO_SIGNATURE_BRAND: StudioBrand = {
  logoUrl:
    "https://lwnrlkkztctxmlrstddd.supabase.co/storage/v1/object/public/brand/logo-firma.gif",
  instagram: "https://www.instagram.com/studionomade_/",
  website: "https://studionomade.cl/",
  linkedin: "https://cl.linkedin.com/company/studionomade",
  behance: "https://www.behance.net/studionomade_",
};

export type SignatureInput = {
  name: string;
  roleTitle?: string | null;
  phone?: string | null;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function socialRow(brand: StudioBrand): string {
  const links: { label: string; url?: string }[] = [
    { label: "Instagram", url: brand.instagram },
    { label: "Web", url: brand.website },
    { label: "LinkedIn", url: brand.linkedin },
    { label: "Behance", url: brand.behance },
  ].filter((l) => l.url);
  if (!links.length) return "";
  const items = links
    .map(
      (l) =>
        `<a href="${esc(l.url!)}" style="color:#1d1d1b;text-decoration:none;font-size:11px;font-weight:600;margin-right:12px;">${l.label}</a>`,
    )
    .join("");
  return `<div style="margin-top:8px;">${items}</div>`;
}

/** HTML de la firma listo para pegar/enviar. */
export function buildSignatureHtml(
  input: SignatureInput,
  brand: StudioBrand = STUDIO_SIGNATURE_BRAND,
): string {
  const name = esc(input.name || "");
  const role = input.roleTitle ? esc(input.roleTitle) : "";
  const phone = input.phone ? esc(input.phone) : "";

  const logoCell = brand.logoUrl
    ? `<td style="padding-right:20px;vertical-align:top;">
         <img src="${esc(brand.logoUrl)}" alt="Studio Nomade" width="72" height="72" style="display:block;border:0;" />
       </td>`
    : "";

  return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;color:#1d1d1b;">
  <tr>
    ${logoCell}
    <td style="vertical-align:top;">
      <div style="font-size:16px;font-weight:700;">${name}</div>
      ${role ? `<div style="font-size:13px;color:#555;margin-top:2px;">${role}</div>` : ""}
      ${phone ? `<div style="font-size:12px;color:#555;margin-top:6px;">${phone}</div>` : ""}
      ${socialRow(brand)}
    </td>
  </tr>
</table>`;
}
