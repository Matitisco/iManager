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

## Estilo

Minimalista: fondo crema `#FBFAF8`, títulos grandes en DM Sans con interletrado negativo, etiquetas chicas en monoespaciada, tarjetas blancas con borde fino y sin sombras decorativas. El amarillo de la marca queda como acento (subrayado de palabras clave, capa activa, logo).

Secciones: hero con scroll · problema («Si tu stock vive en un Excel, no es escalable») · funciones · cómo funciona · precios · preguntas · CTA final · footer. Las opiniones de clientes se suman recién cuando haya reales.

Precios: `PLANS` en `src/content.ts`. Mensual: Básico US$ 22, Avanzado US$ 87, Completo US$ 246. Anual (25% menos, por mes con pago anual): US$ 16,50 / 65,25 / 184,50, con el total del año abajo (US$ 198 / 783 / 2.214). A medida no muestra precio. Los montos se escriben ya formateados, tal como los confirmó el dueño.

- `SHOW_PRICING = false` oculta la sección y saca el link del menú y del footer.
- `SHOW_BILLING_TOGGLE = false` saca el selector Mensual/Anual y deja solo los precios mensuales.
- Cada plan lista lo que suma sobre el anterior («Todo lo del plan …»). Solo funciones que la app ya tiene; lo que falta va con `soon: true` («Próximamente»).
- `PRICING_BENEFITS` es la franja debajo de los planes, con el mismo criterio.

## Hero: teléfono que se desarma con el scroll

- `src/hero/Hero.tsx` — las 5 capas como planos CSS 3D (cada plano con su transformación completa bajo una misma perspectiva, sin `preserve-3d`), etiquetas y riel de progreso. Piezas de despiece reales: pantalla de vidrio con bisel fino, Dynamic Island y barra de estado; marco de titanio (anillo con máscara, bandas de antena, puerto y botones laterales, con un plano intermedio para que la pared lateral se vea continua); placa lógica en SVG (`Placa.tsx`: blindajes, SoC, conectores, pasivos, tornillos); batería con flex y lengüetas; carcasa por dentro con cámaras, bobina MagSafe e imanes. Cada capa tiene su profundidad de borde (`EDGE_DEPTHS`) y una sombra de contacto la acompaña.
- `src/hero/pose.ts` — función pura `pose(p, mobile, fit)` y `projectPoint()` / `phoneBounds()`, que proyectan anclajes de etiquetas y la caja del teléfono con la misma cadena de transformaciones CSS (así no se lee layout en cada frame).
- Layout medido, sin offsets fijos: en mobile el teléfono arranca debajo del copy real (alto variable por ancho, fuentes o escalado de texto del sistema) y sube junto con él, así nunca lo pisa.
- Desktop siempre en dos columnas, en todos los frames: copy, CTAs y contenido de cada función a la izquierda (columna de 500px), teléfono explotado con sus etiquetas y el riel a la derecha (44 % / 54 % del escenario, 270×560, perspectiva 2200px). En pantallas de más de 900px de alto crece hasta 15 %; en columnas angostas o pantallas bajas se achica; en pantallas altas y angostas (iPad vertical, «Sitio de escritorio» en un celular) separa más las capas y, si aun así sobra alto, el sticky mide lo que el contenido.
- Un único `requestAnimationFrame` lee `scrollY` y escribe solo `transform` / `opacity` (y atributos SVG de las líneas). React solo re-renderiza cuando cambia el estado (caption activo, capa resaltada).

Rangos desktop (sección de 500vh, teléfono sticky): 0–8 entero · 8–20 en capas · 20–33 inventario/IMEI (placa) · 33–46 ventas (pantalla) · 46–59 canjes (carcasa) · 59–72 servicio técnico (batería) · 72–85 dólar (marco) · 85–100 re-armado + CTA.

Mobile (≤900px): sticky de 200vh con 3 capas (pantalla, placa, carcasa) y después tarjetas deslizables.

`prefers-reduced-motion: reduce`: sin sticky ni scroll-jacking; el hero muestra el titular con la vista explotada fija y las funciones se leen como lista.
