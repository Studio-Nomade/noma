# Envío de propuestas por correo (Gmail API)

Noma envía la propuesta **como el usuario** (remitente = la cuenta
`@studionomade.cl` de quien gestiona la venta), con el **PDF adjunto**, vía la
Gmail API. Esto requiere una configuración única en Google + variables de entorno.

## Cómo funciona

1. Al iniciar sesión, Noma pide el permiso `gmail.send` y `access_type=offline`
   → Google entrega un **refresh token** que se guarda en `user_integrations`.
2. Al enviar, Noma genera el PDF (`/proposals/[id]/pdf`), renueva el access token
   con el refresh token (usando `GOOGLE_CLIENT_ID/SECRET`) y llama a
   `gmail.users.messages.send` con el correo + adjunto.
3. La propuesta pasa a **Enviada** y se registra en el hilo de Seguimiento.

## Setup (una vez)

### 1. Google Cloud Console

- **APIs & Services → Library → Gmail API → Enable**.
- **OAuth consent screen → Scopes → Add**:
  `https://www.googleapis.com/auth/gmail.send`
  (es un scope sensible; en una app **Internal** del Workspace se usa sin
  verificación de Google. Si el consent es "External", agrega usuarios de prueba.)
- **Credentials → tu OAuth client** (el mismo que usa Supabase): confirma que el
  **Authorized redirect URI** del callback de Supabase siga ahí.

### 2. Variables de entorno

En `.env.local` (y en Vercel) completa con las credenciales del **mismo** OAuth
client de Google que configuraste en Supabase:

```
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
```

### 3. Re-login para conceder el permiso

Como el scope es nuevo, **cierra sesión y vuelve a entrar**. Acepta el permiso de
Gmail. Recién ahí Google emite el refresh token (Noma lo guarda solo).

## Probar

Abre una cotización → **Enviar** → elige contactos del cliente, CC, edita el
cuerpo (plantilla) → Enviar. Debería llegar el correo desde tu cuenta con el PDF
adjunto, y el correo quedará en tus **Enviados** de Gmail.

## Notas

- Los **contactos del cliente** se gestionan en la ficha del cliente.
- Las **plantillas** se editan en `/settings/email-templates` (variables
  `{{cliente}} {{contacto}} {{proyecto}} {{propuesta}} {{total}} {{remitente}}`).
- El refresh token es sensible: vive en `user_integrations` (RLS deny-by-default,
  acceso solo server-side). Considerar cifrado en reposo a futuro.
- Supabase → Authentication → Providers → Google: no requiere cambios extra, pero
  el scope debe estar permitido en el proyecto de Google.
