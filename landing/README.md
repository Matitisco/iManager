# iManager · Landing A2 clara

Landing de marketing independiente de la app: Vite + React 19 + TypeScript y DM Sans autoalojada. Sin dependencias nuevas. Fuente visual: `var-a2.html`, `var-a2-1440.png` y `var-a2-390.png` del diseño A2 aprobado.

## Desarrollo y verificación

```bash
cd landing
npm ci
npm run dev              # http://localhost:5180
npm run build            # TypeScript + Vite cliente/SSR + prerender
PORT=4181 npm run start  # sirve dist/; Railway define PORT
npm run shots            # full-page 1440×900 y 390×844, a 2x, en shots/
npm run check:layout     # 320/360/390/768/1024/1440/1920; geometría, imágenes y pestañas
```

Las herramientas de navegador usan Chromium de `~/.cache/ms-playwright` o Chrome instalado. `CHROME_PATH` permite elegir otro ejecutable; `LANDING_URL` cambia el destino (por defecto `http://localhost:4181/`) y `SHOTS_DIR` la carpeta de capturas. Requieren el servidor corriendo. `NOINDEX=1` agrega el header de noindex para previews.

## Estructura

- `src/App.tsx`: barra simple y hero, problema, solución, tres pasos, beta/contacto, cierre y pie. Las rutas desconocidas muestran `NotFound` de `Legal.tsx`.
- `src/Nav.tsx`: enlaces a secciones; en móvil, logo y CTA sin hamburguesa ni navegación fija.
- `src/Sections.tsx`: ilustraciones CSS decorativas del problema, capturas reales, bento y llamadas a la acción.
- `src/content.ts`: destinos de app/WhatsApp, metadatos y contenido de las pestañas Stock/Ventas/Reportes.
- `src/styles.css`: estilos A2 con sus espacios, sombras y recortes; composiciones de escritorio/móvil y ajustes intermedios. DM Sans conserva el tamaño óptico 9 del wireframe. Tokens de la guía iManager, botón negro y amarillo sobre la tarjeta oscura. El secundario de texto pequeño se oscurece ligeramente para contraste AA; las ilustraciones quedan decorativas.
- `public/assets/a2/*.webp`: capturas optimizadas de la app con datos de demo ficticios, conservadas sin cambios. Los textos de las ilustraciones del problema son ejemplos.

Las pestañas usan estado React, roles tablist/tab/tabpanel, foco itinerante y teclas ←/→/Inicio/Fin. Stock está activo en SSR y en la primera hidratación; los otros paneles quedan `hidden`. Se respeta `prefers-reduced-motion`.

Todos los CTA de acceso/alta apuntan a `APP_URL`. «Contanos» abre WhatsApp con `noopener noreferrer`. La oferta es gratis durante la beta, sin planes ni precios.

## SEO y deploy

`entry-server.tsx` y `scripts/prerender.mjs` generan `dist/index.html` con todo el contenido y `dist/404.html` con noindex. El título y las descripciones se centralizan en `content.ts`; `index.html` conserva canonical, Open Graph, Twitter y preload del dashboard WebP del hero. Las capturas declaran dimensiones originales; fuera del hero usan carga diferida.

`railway.json` mantiene `npm run build` → `npm run start`. `serve.mjs` sirve los archivos estáticos y responde 404 en rutas desconocidas. La app y el backend no participan de esta landing.
