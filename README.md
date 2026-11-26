# Pendientes

Una lista de pendientes que cargas desde el celular (Android o iPhone) y ves en la compu, sincronizada al instante.

Es una app web instalable (PWA): el mismo código funciona en el celular y en el escritorio, se instala como app desde el navegador y no hace falta publicarla en las tiendas. Los datos se guardan en Supabase.

## Qué hace

- Crear cuenta y entrar con correo y contraseña. Cada persona ve solo sus pendientes.
- Agregar, marcar como hecho, desmarcar y borrar pendientes. Los hechos se agrupan abajo y se pueden borrar todos juntos.
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
| `supabase/migrations/` | La tabla `pendientes` con reglas para que cada usuario vea solo lo suyo |

No hay paso de compilación: son archivos estáticos.

Para probarla en tu compu: `python3 -m http.server 8000` dentro de la carpeta y abre http://localhost:8000. Para que el correo de confirmación vuelva a esa dirección, agrégala también en **Redirect URLs** de Supabase.

Al publicar cambios, sube el número de `VERSION` en `sw.js` para que los celulares que ya la tienen instalada descarguen lo nuevo.

> La dirección distingue mayúsculas: es `/Pendientes/` con P mayúscula, igual que el nombre del repositorio.
