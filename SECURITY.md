# Política de seguridad

## Reporte de vulnerabilidades

Si encuentras una vulnerabilidad en Noma, repórtala de forma privada a
**branding@studionomade.cl**. No abras un issue público para temas de seguridad.

## Manejo de secretos

- **Nunca** se versionan secretos, credenciales ni tokens en este repositorio.
  Las variables de entorno se documentan por nombre en [`.env.example`](.env.example);
  los valores reales viven en el gestor de secretos de Vercel / entorno local.
- Los archivos `.env*` (salvo `.env.example`), `client_secret*.json`, `credentials*.json`,
  `token*.json`, `*.pem`, `*.key`, `*.p12` y `*.crt` están en `.gitignore`.
- El acceso a la plataforma exige SSO de Google Workspace del dominio del estudio.

## Datos sensibles

El conocimiento interno, comercial y estratégico del estudio (pricing, procesos, análisis de
servicios/SLA, presupuestos) **no** vive en este repositorio público, sino en el repo
**privado** `noma-ops`. No introducir ese tipo de contenido en `noma-app`.
