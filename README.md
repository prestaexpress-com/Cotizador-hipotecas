# Cotizador de Hipotecas — CC Consulting

Aplicación web para cotizar hipotecas, persistir cotizaciones en Supabase y permitir que los clientes consulten/editen sus datos mediante un token.

## Estructura

```
.
├── index.html                  Cotizador principal
├── admin.html                  Panel de administración (login con Supabase Auth)
├── ver-cotizacion.html         Vista del cliente (acceso por token)
├── config.example.js           Plantilla de configuración (sí va a Git)
├── config.js                   Configuración real con credenciales (NO va a Git)
├── supabase-client.js          Cliente unificado con helpers compartidos
├── supabase-integration.js     Integración del cotizador con Supabase
└── .gitignore
```

## Configuración inicial

1. Copia la plantilla de configuración:

   ```bash
   cp config.example.js config.js
   ```

2. Edita `config.js` con tus credenciales reales de Supabase:

   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
     SUPABASE_KEY: 'tu_publishable_key_aqui'
   };
   ```

3. `config.js` está en `.gitignore` y nunca se subirá al repositorio.

## Despliegue

Cualquier servidor de archivos estáticos sirve (Netlify, Vercel, GitHub Pages, etc.). Sube todo el directorio excepto `config.js`, y en tu plataforma de hosting genera/edita el archivo `config.js` con las credenciales del entorno correspondiente.

### GitHub Pages

GitHub Pages no soporta variables de entorno. Una opción es mantener `config.js` fuera del repo y agregarlo manualmente al deploy, o usar GitHub Actions para generarlo desde un secret.

### Netlify / Vercel

Puedes usar un build step que escriba `config.js` desde variables de entorno:

```bash
echo "window.APP_CONFIG = { SUPABASE_URL: '$SUPABASE_URL', SUPABASE_KEY: '$SUPABASE_KEY' };" > config.js
```

## Seguridad

- **El publishable key (anon key) de Supabase es seguro publicar** en el frontend porque depende de las políticas RLS (Row Level Security) para proteger los datos. Sin embargo, mantenerlo fuera del repo permite rotarlo sin reescribir código.
- **Nunca uses el `service_role` key** en código del frontend.
- Verifica que tu tabla `cotizaciones` tenga RLS activo en Supabase con políticas que permitan:
  - INSERT anónimo (para que cualquiera pueda crear cotizaciones desde el cotizador)
  - SELECT/UPDATE solo cuando se conoce el `edit_token` (acceso del cliente)
  - SELECT/UPDATE/DELETE solo para usuarios autenticados (panel admin)
- El token de sesión del admin se guarda en `sessionStorage` (se pierde al cerrar la pestaña) en lugar de `localStorage`, para reducir exposición a XSS.

## Rotar credenciales

Si las credenciales se filtran o quieres rotarlas:

1. En Supabase Dashboard → Settings → API → Rotar el publishable key.
2. Actualiza el `config.js` local y en producción.
3. No hace falta tocar el código.
