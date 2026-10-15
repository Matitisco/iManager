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
npm run check:layout  # hero en 360–430 mobile y 980–1920 desktop: sin solapes ni bandas vacías (sale con 1 si falla)
```

## Hero: teléfono que se desarma con el scroll

- `src/hero/Hero.tsx` — markup de las 5 capas (carcasa, batería, placa, marco, pantalla) como planos CSS 3D (cada plano con su transformación completa bajo una misma perspectiva, sin `preserve-3d`) con borde extruido, etiquetas y riel de progreso.
- `src/hero/pose.ts` — función pura `pose(p, mobile, fit)` con los rangos y las interpolaciones lineales del JS de los wireframes, y `projectPoint()` / `phoneBounds()`, que proyectan anclajes de etiquetas y la caja del teléfono con la misma cadena de transformaciones CSS (así no se lee layout en cada frame).
- Layout medido, sin offsets fijos: en mobile el teléfono arranca debajo del copy real (alto variable por ancho, fuentes o escalado de texto del sistema) y sube junto con él, así nunca lo pisa.
- Desktop siempre en dos columnas, en todos los frames: copy, CTAs y contenido de cada función a la izquierda (columna de 500px), teléfono explotado con sus etiquetas y el riel a la derecha. El teléfono se ubica como en el wireframe (44 % / 54 % del escenario, 270×560, perspectiva 2200px) y el fondo amarillo está centrado en 72 % / 40 % del viewport. Solo se adapta si no entra: escala el escenario en columnas angostas o pantallas bajas y, en pantallas altas (iPad vertical, «Sitio de escritorio» en un celular), separa más las capas y, si aun así sobra alto, el sticky mide lo que el contenido.
- `npm run check:layout` y la comparación cuadro a cuadro contra `?shot=hero&p=…` del wireframe (p = .05, .15, .25, .36, .48, .60, .72, .84, .99) son la referencia para cualquier cambio del hero.
- Un único `requestAnimationFrame` lee `scrollY` y escribe solo `transform` / `opacity` (y atributos SVG de las líneas). React solo re-renderiza cuando cambia el estado (caption activo, capa resaltada).

Rangos desktop (sección de 900vh, teléfono sticky): 0–10 entero · 10–20 separando · 20–30 explotado · 30–42 inventario/IMEI (placa) · 42–54 ventas (pantalla) · 54–66 canjes (carcasa + cubito) · 66–78 servicio técnico (batería) · 78–90 dólar (marco) · 90–100 re-armado + CTA.

Mobile (≤900px): sticky de 240vh con 3 capas (pantalla, placa, carcasa) y después tarjetas deslizables.

`prefers-reduced-motion: reduce`: sin sticky ni scroll-jacking; el hero muestra el titular con la vista explotada fija y las funciones se leen como lista.

## Precios

Cuatro planes confirmados (Básico, Avanzado, Completo y A medida). A medida no muestra monto. El toggle Anual aplica 25% menos y los CTAs de alta van a https://app.imanager.com.ar/.
