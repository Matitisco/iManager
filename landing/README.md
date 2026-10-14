# iManager · Landing (imanager.com.ar)

Landing de marketing de iManager. Proyecto independiente de la app principal: Vite + React 19 + TypeScript, sin dependencias de runtime aparte de React y la fuente DM Sans autoalojada.

Fuente de verdad visual: wireframes hi-fi `imanager-landing-wireframes.tgz` (`index.html`, storyboard del hero y PNG por sección).

## Comandos

```bash
cd landing
npm install
npm run dev       # http://localhost:5180
npm run build     # tsc + vite build → dist/
npm run start     # sirve dist/ (PORT, NOINDEX=1 agrega X-Robots-Tag: noindex)
npm run shots     # capturas del hero (requiere `npm run preview` y Chrome; CHROME_PATH opcional)
```

## Hero: teléfono que se desarma con el scroll

- `src/hero/Hero.tsx` — markup de las 5 capas (carcasa, batería, placa, marco, pantalla) como planos CSS 3D (`preserve-3d`) con borde extruido, etiquetas y riel de progreso.
- `src/hero/pose.ts` — función pura `pose(p, mobile)` con los rangos del README de los wireframes y `projectAnchor()`, que proyecta los anclajes de las etiquetas con la misma cadena de transformaciones CSS (así no se lee layout en cada frame).
- Un único `requestAnimationFrame` lee `scrollY` y escribe solo `transform` / `opacity` (y atributos SVG de las líneas). React solo re-renderiza cuando cambia el estado (caption activo, capa resaltada).

Rangos desktop (sección de 900vh, teléfono sticky): 0–10 entero · 10–20 separando · 20–30 explotado · 30–42 inventario/IMEI (placa) · 42–54 ventas (pantalla) · 54–66 canjes (carcasa + cubito) · 66–78 servicio técnico (batería) · 78–90 dólar (marco) · 90–100 re-armado + CTA.

Mobile (≤900px): sticky de 240vh con 3 capas (pantalla, placa, carcasa) y después tarjetas deslizables.

`prefers-reduced-motion: reduce`: sin sticky ni scroll-jacking; el hero muestra el titular con la vista explotada fija y las funciones se leen como lista.

## Placeholders

Testimonios y precios son de ejemplo y están marcados como tales («Testimonio de ejemplo», «Ejemplo · a definir»).
