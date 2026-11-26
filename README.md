# Pendientes

Una lista de pendientes que cargas desde el celular (Android o iPhone) y ves en la compu, sincronizada al instante.

Es una app web instalable (PWA): el mismo código funciona en el celular y en el escritorio, se instala como app desde el navegador y no hace falta publicarla en las tiendas. Los datos se guardan en Supabase.

## Qué hace

- Crear cuenta y entrar con correo y contraseña. Cada persona ve solo sus pendientes.
- Agregar, marcar como hecho, desmarcar y borrar pendientes. En la compu, pendientes y hechos se ven en dos columnas lado a lado; en el celular, los hechos van debajo. Los hechos se pueden borrar todos juntos, con confirmación previa.
- Agregar una descripción opcional a cada pendiente; se ve tocando "Ver más".
- Minimizar la columna de Hechos: en la compu queda como una pestaña a la derecha y Pendientes ocupa todo el ancho (el dispositivo lo recuerda).
- Recordatorios: la campana de cada pendiente permite elegir fecha y hora para recibir una notificación, aunque la app esté cerrada. En iPhone hace falta tener la app instalada en la pantalla de inicio (iOS 16.4 o posterior).
- Cambiar entre tema claro y oscuro con el botón de arriba (por defecto sigue al del sistema).
- Clasificar cada pendiente por urgencia (baja, media o alta). La lista muestra primero los más urgentes, se puede filtrar por urgencia y tocando la etiqueta de un pendiente se cambia su urgencia.
- Lo que cambias en un dispositivo aparece en los demás al momento.
- Se instala en la pantalla de inicio del celular y abre aunque no haya internet (para ver o cambiar pendientes sí necesita conexión).

## Puesta en marcha (una sola vez)

### 1. Activar GitHub Pages

1. En GitHub, abre **Settings → Pages** de este repositorio.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Cada vez que haya cambios en `main`, la app se publica sola en
   **https://martinlvx.github.io/Pendientes/**
   (si la primera publicación falló porque Pages no estaba activo, entra a **Actions → Publicar en GitHub Pages → Run workflow**).

### 2. Decirle a Supabase dónde vive la app

Esto hace que el enlace del correo de confirmación te lleve de vuelta a la app.

1. Entra a tu proyecto **pendientes** en [supabase.com](https://supabase.com/dashboard).
2. Ve a **Authentication → URL Configuration**.
3. En **Site URL** pon `https://martinlvx.github.io/Pendientes/`.
4. En **Redirect URLs** agrega `https://martinlvx.github.io/Pendientes/` y guarda.

## Instalar en el celular

- **iPhone:** abre la dirección en **Safari**, toca el botón **Compartir** y luego **Agregar a pantalla de inicio**.
- **Android:** abre la dirección en **Chrome**, toca el menú **⋮** y luego **Instalar app** (o **Agregar a pantalla principal**).
- **Escritorio:** ábrela en Chrome o Edge; en la barra de direcciones aparece un ícono para instalarla, o úsala directamente en el navegador.

La primera vez crea tu cuenta, confirma el correo y entra con la misma cuenta en todos tus dispositivos.

## Cómo está hecho

| Archivo | Para qué |
| --- | --- |
| `index.html`, `style.css`, `app.js` | La app |
| `config.js` | Dirección y clave pública de Supabase (es seguro que sea pública) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Lo que la hace instalable y abrir sin conexión |
| `vendor/supabase.js` | Librería oficial de Supabase (v2.118.0, licencia MIT) |
| `supabase/functions/enviar-recordatorios/` | Función que envía las notificaciones; `pg_cron` la llama cada minuto. Las claves VAPID privadas viven en el Vault de Supabase |
| `supabase/migrations/` | La tabla `pendientes` con reglas para que cada usuario vea solo lo suyo |

No hay paso de compilación: son archivos estáticos.

Para probarla en tu compu: `python3 -m http.server 8000` dentro de la carpeta y abre http://localhost:8000. Para que el correo de confirmación vuelva a esa dirección, agrégala también en **Redirect URLs** de Supabase.

Al publicar cambios, sube el número de `VERSION` en `sw.js` y el `?v=` de `style.css`, `config.js` y `app.js` en `index.html`, para que los navegadores y los celulares con la app instalada descarguen lo nuevo de inmediato.

> La dirección distingue mayúsculas: es `/Pendientes/` con P mayúscula, igual que el nombre del repositorio.
