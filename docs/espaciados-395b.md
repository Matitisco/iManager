# Ajustes finales de espaciado #395

Se revisó el commit parcial `d57f416` sin revertirlo. Sus correcciones cubren los quince puntos; esta continuación corrige además el selector de padding interno de las filas de Ventas (`.phone-row`, la clase real) y completa la validación.

Se conservaron colores, tipografías, componentes y estilos. Sin cambios de backend, Prisma ni schema. Sin build ni push.

## Revisión por punto

| # | Resultado y evidencia |
|---|---|
| 1 | Comisiones móvil: grid con mínimos de cero, nombres largos con elipsis, tarjetas dentro de x14–376 y columna Pendiente visible. |
| 2 | Equipo y Permisos: grids contraídos al ancho disponible, emails largos con elipsis, sin desborde del documento ni del scrollport. |
| 3 | Sidebar desktop de 248px: email con elipsis y extremo derecho dentro de la barra. |
| 4 | Dashboard móvil: la píldora 4/5 tiene su espacio fuera del scrollport; éste termina en y702 y la píldora empieza en y712. Las tarjetas siguen siendo desplazables. |
| 5 | Clientes desktop: Todos y Con saldo pendiente en la misma fila, bajo los tabs del módulo. |
| 6 | Ventas móvil: fila de x14 a x376, círculo dentro del margen y contenido separado; selección también comprobada. |
| 7 | Configuración usa la misma lista de miembros de la API que Equipo; prueba con respuesta demorada muestra «…» y después 2 en ambas vistas. Equipo › hereda mayúsculas y color de los labels de sección. |
| 8 | Ayuda desktop: título y contenido a x284, alineados con el resto de pantallas. |
| 9 | Catálogo, Equipo y Permisos móvil reutilizan BackButton; se comprobó la navegación de regreso. |
| 10 | Comisiones desktop: contenedor con márgenes de 36px, tabla interior x285–1403 incluyendo el borde del contenedor. |
| 11 | Login móvil: márgenes de 14px, 28px entre Olvidaste y submit; sin espacio flexible que empuje las acciones al pie. |
| 12 | Login móvil/desktop: submit y Google de 54px. |
| 13 | Reportes: título a y60 móvil / y28 desktop; segunda fila de chips contenida entre los márgenes de 14px en móvil. |
| 14 | Nueva caja usa dbtn s igual que Nuevo cliente; borde sólido de 1px en ambos tamaños. |
| 15 | Dashboard móvil a x14; títulos estándar desktop de 33px, incluidos Catálogo, Cajas y Configuración. |

## Capturas y reproducción

- Antes: 25 imágenes originales de `/workspace/qa-395/`, copiadas sin modificar a `docs/pr-shots/395b-antes-*.png`.
- Después: 27 capturas con datos ficticios a 390×844 y 1440×900, incluidas Inventario como referencia y Ventas en selección. Se inspeccionaron visualmente.
- Medidas: `docs/pr-shots/395b-geometria-mobile.json` y `395b-geometria-desktop.json`.
- Spec: `e2e/395b-shots.spec.ts`, aislado de la suite normal mediante `testIgnore` y configuración propia.

```sh
npx playwright test --config e2e/395b-shots.config.ts
npm run lint
npm --prefix backend run lint
npm run test:frontend -- --maxWorkers=2
npx playwright test --workers=2
```

Las capturas no necesitan backend: todos sus datos son fixtures interceptados. Cada pantalla exige `document.documentElement.scrollWidth <= viewport` y comprueba también el ancho del scrollport para detectar contenido oculto por el clipping del shell. Las aserciones específicas verifican coordenadas, alturas, elipsis, contador demorado, outline y regreso.

El entorno local requiere las bibliotecas de WebKit ya preparadas para #395 y su wrapper que conserva `LD_LIBRARY_PATH`; la suite usa sólo PostgreSQL local `imanager_test`. No se consultaron datos productivos.

## Validación

- TypeScript frontend y backend: aprobados (`npm run lint`, `npm --prefix backend run lint`).
- Frontend: 949 tests aprobados en 131 archivos, con dos workers; los 15 de Configuración se revalidaron tras mejorar el aislamiento del mock.
- Capturas/geometría: 2 tests aprobados; 27 capturas después, todas con las dimensiones solicitadas.
- E2E completo: 256 casos recorridos, 237 aprobados, 7 omitidos por sus condiciones existentes y 12 fallidos en la primera pasada. Se corrigieron selectores de navegación/carga y rutas de capturas; la revalidación con un worker aprobó 14 de 15 casos (los 12 fallos más 3 controles), y el caso restante de operaciones masivas pasó en dos repeticiones consecutivas tras agregar la espera de transición a Ventas. Los doce fallos iniciales quedaron revalidados; no se ejecutó otra pasada completa después de estas correcciones.
- Señas Android, arranque de Inventario y health de la fixture de Comisiones pasaron en la revalidación sin cambiar la lógica de negocio; en la pasada concurrente hubo un conflicto serializable y timeouts de arranque.
- Capturas antiguas de otros issues: restauradas al cerrar la validación.

Se reparó el mock de matchMedia que se capturaba antes del beforeAll global, se agregaron esperas al entrar a Ventas y al recargar planes, se actualizó el selector de la flecha Volver, se aislaron avisos de instalación/cotización en los tests de facturación y sus capturas auxiliares ahora usan el directorio de resultados de Playwright en vez de `/opt/cursor`. Las imágenes previas de otros issues se conservan.

## Entrega del commit

El directorio Git compartido del worktree está montado como sólo lectura: `git checkout --` y el registro del commit no pueden crear `index.lock`. Se restauraron las 31 imágenes previas con un índice temporal (sin modificar los metadatos protegidos), y se preparó el commit en una copia local con metadatos escribibles, conservando el HEAD parcial como padre y el nombre de rama `fix/395-espaciados`. Bundle transportable: `/tmp/395b-espaciados.bundle`; parche equivalente: `/tmp/395b-espaciados.patch`. No se hizo push. La referencia del worktree original permanece en `d57f416` por esa limitación.
