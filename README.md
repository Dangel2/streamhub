StreamHub Activador 🚀
StreamHub Activador es una solución serverless diseñada para ejecutar en Cloudflare Workers con almacenamiento en Cloudflare KV. Permite gestionar la autenticación de usuarios mediante OTP integrado con Telegram, administrar sesiones seguras y ejecutar flujos de activación de dispositivos para múltiples plataformas de streaming.
🛠️ Características principales
 * Motor único sin dependencias (Single-File Worker): Todo el backend estructurado en un solo archivo JavaScript, evitando bundlers, utilidades CLI adicionales o fallos por rutas de import.
 * Autenticación y Seguridad:
   * Generación de códigos OTP con expiración (5 min).
   * Emisión y validación de tokens firmados mediante HMAC (SHA-256).
   * Control de frecuencia de peticiones (Rate Limiting).
   * Configuración de cabeceras CORS dinámicas.
 * Integración con Telegram:
   * Envío automático de códigos OTP al chat de Telegram del usuario.
   * Notificaciones en tiempo real al administrador sobre nuevos registros y fallos de activación.
   * Generación de reportes automáticos programados mediante Cron Triggers.
 * Gestión de Usuarios y Métricas: Registro de actividad, estadísticas diarias y almacenamiento distribuido mediante Cloudflare KV.
 * Soporte Multi-Plataforma (Fases Live y Beta):
   * Netflix (Live)
   * Disney+ (Beta)
   * Max (Beta)
   * Prime Video (Beta)
   * Paramount+ (Beta)
   * Crunchyroll (Beta)
   * Spotify (Beta)
📋 Requisitos previos
 * Una cuenta activa en Cloudflare.
 * Un bot de Telegram creado a través de @BotFather (obtené tu BOT_TOKEN).
 * Tu ID numérico de Telegram obtenido a través de @userinfobot (para ADMIN_CHAT_ID).
🚀 Despliegue en Cloudflare Workers
1. Crear el espacio de almacenamiento KV
 * En el panel de Cloudflare, dirígete a Storage & Databases → KV.
 * Haz clic en Create a namespace.
 * Asigna el nombre streamhub y guarda los cambios.
2. Crear el Worker
 * Ve a Workers & Pages → Create application → Create Worker.
 * Nombra tu Worker como streamhub-activador y haz clic en Deploy.
3. Vincular el KV (Binding)
> Importante: Este paso debe realizarse antes de guardar el código final para evitar errores de referencia en ejecución.
> 
 * Dentro de la configuración de tu Worker, ve a Settings → Bindings.
 * Haz clic en Add → KV namespace.
 * Configura:
   * Variable name: DB (en mayúsculas)
   * KV namespace: streamhub
 * Guarda los cambios (Save and Deploy).
4. Desplegar el código
 * Entra en Edit Code dentro de tu Worker.
 * Borra el contenido por defecto y pega el código completo del script.
 * Haz clic en Deploy.
⚙️ Variables de Entorno y Secretos
En la pestaña Settings → Variables and Secrets, agrega las siguientes variables:
| Nombre | Tipo | Descripción / Ejemplo |
|---|---|---|
| HMAC_SECRET | Secret | Clave aleatoria de 40+ caracteres para firma de tokens. |
| ADMIN_PASSWORD | Secret | Contraseña para el acceso al panel administrativo. |
| BOT_TOKEN | Secret | Token API de Telegram provisto por BotFather. |
| ADMIN_CHAT_ID | Secret | ID numérico del administrador en Telegram. |
| ALLOWED_ORIGIN | Text | Dominio permitido para CORS (ej. [https://tuusuario.github.io](https://tuusuario.github.io) o *). |
⏲️ Configuración del Reporte Diario (Cron Trigger)
 * Dentro de tu Worker, ve a Settings → Trigger Events.
 * En la sección Cron Triggers, haz clic en Add Trigger.
 * Configura la expresión cron (ej. 0 12 * * * para ejecutar todos los días a las 12:00 UTC).
📌 Verificación del Estado
Puedes comprobar que el servicio está activo navegando a la ruta de salud:
https://streamhub-activador.TU-SUBDOMINIO.workers.dev/api/health

Respuesta esperada:
{
  "ok": true,
  "plataformas": [
    "netflix",
    "disneyplus",
    "max",
    "primevideo",
    "paramount",
    "crunchyroll",
    "spotify"
  ]
}

