# CI completa de main: diagnóstico y reproducción

Referencia: `f490f62`, corrida [39902387223](https://github.com/Matitisco/iManager/actions/runs/39902387223). Última verde: [39862593033](https://github.com/Matitisco/iManager/actions/runs/39862593033), commit `cde82b9`, iniciada el 22/10 a las 22:07:29Z. Primera roja posterior: [39863365263](https://github.com/Matitisco/iManager/actions/runs/39863365263), `d0a896d` (#502), a las 22:13:39Z.

El primer fallo observado fue el scanner móvil: #502 no cambia ese código. La prueba simulaba una ráfaga de lector mediante múltiples mensajes CDP con demora de 8 ms; el tiempo de planificación del runner podía superar el umbral del lector. Se fija únicamente Date durante la ráfaga simulada y se restaura después. La distinción real entre entrada lenta y rápida sigue cubierta por `keyboard-wedge.test.ts`. También se recargan las listas después de sembrar fixtures por API: navegar sólo al hash ya no garantiza otra consulta dentro de la ventana de 15 segundos.

| Fallo | Clasificación y causa | Corrección |
| --- | --- | --- |
| Facturación iPhone / Registrar venta en Caja | Rotura real desde `4489cf8` (#521): `.stage-notices` fijo intercepta clics; el log identifica el banner de plan o `.fx-warn`. | Los avisos persistentes ocupan espacio en el flujo. Se conservan componentes, textos, tokens y acciones. |
| Canjes, señas y Reportes tras reload | Helper consulta `isVisible()` antes de que se resuelva el shell; interpreta escritorio como móvil, o busca accesos que ahora están agrupados. | Esperar navegación disponible y usar `openDeskSection`. |
| Offline / catálogo | #515 retiró banners; #521 conserva datos ante errores de red. El test todavía esperaba que desapareciera el precio. | Esperar el fallo de red, comprobar precio conservado y una respuesta exitosa al reconectar, sin banner. |
| Mobile clients/service/settings/sales/trade-ins/notifications | Desde #521 esperan `.enter-f`, retirado; cada prueba consume hasta 180 segundos. | Esperar animaciones del contenedor real `.stage`. |
| Historial de reparaciones | #503 reemplazó la línea inline por el botón que abre Historial. | Abrir la segunda ventana y verificar estados y cantidad de eventos, conservando el resto del flujo. |
| Importación de clientes | La lista pagina de a 8; el test esperaba 10 filas simultáneas. | Verificar ambas páginas (8 + 2), el total 10, persistencia y búsqueda. |
| Dashboard / animación del tab | Nuevos encabezados hacen ambiguo “Ventas”; #521 acorta la transición. | Nombre exacto y prueba de interpolación, sin fijar la duración anterior. |
| Menú contextual | #521 mueve el scrim a `::before`; el test miraba el fondo transparente del padre. | Comprobar el pseudo-elemento y conservar geometría, superposición y acciones. |
| Control de stock y scan-review | Etiquetas de controles cambiaron; IMEI simple vuelve al formulario; edición manual del modelo se conserva desde #531. | Verificar los controles actuales, el IMEI leído y la preservación explícita de una edición manual. |
| Resumen periódico | #506 retiró el botón de error secundario. | Verificar respuesta fallida y recuperación al volver a elegir el período. |
| PWA | #521 conserva la pestaña visible hasta pulsar Actualizar. Los tests seguían esperando navegación automática y agotaban 15 minutos. | Conservar borrador/guardado y confirmar la actualización una vez cerrado el formulario. |
| Historial con PostgreSQL no UTC | Rotura real adicional: parámetros Date vinculados como timestamptz contra columnas timestamp. Se perdía `old-2` al paginar en Buenos Aires. | Normalizar límites y cursor a UTC; integración en UTC y America/Argentina/Buenos_Aires. Sin migraciones. |

El job `test` agrega los resultados de otros jobs; no contiene un test offline propio. Los shards 3/4 y PWA agotaban el tiempo entre expectativas retiradas y reintentos. Se mantienen los límites y el smoke de PR; la suite completa se reparte en ocho shards E2E y un job PWA por navegador. Los reporters muestran progreso por prueba y PWA conserva evidencia de fallos.

## Entorno y evidencia

API :3390 / web :4390. PostgreSQL falso exclusivo :5490; bases `imanager_mainverde` e `imanager_mainverde_integration`. Las primeras pasadas compartidas detectaron saturación de conexiones y se descartaron como validación final. No se accedió a bases reales, variables de Railway ni secretos. No hay cambios de esquema.

Capturas en `/workspace/qa-main-verde/`: `before-1440.png`, `before-390.png`, `after-1440.png`, `after-390.png`, con Chrome `/usr/bin/google-chrome`, `--no-sandbox`. Se inspeccionaron ambas resoluciones y se verificó el clic real hacia facturación. La repetición “before” inyecta en el navegador las reglas originales del contenedor para comparar la misma acción desplazada. Notas reproducibles en `notas.md` de esa carpeta.

Validación local: TypeScript frontend/backend; 1.923 pruebas frontend; 606 unitarias backend; 412 integraciones backend antes de agregar las dos regresiones de zona horaria; 15 checks PWA; suites PWA completas de los tres navegadores. Se ejecutaron los 312 casos E2E y se repitieron los fallidos y relacionados con dos workers, sin cambiar timeouts ni agregar skips. Los logs y resultados están en la misma carpeta de QA. Las omisiones por plataforma ya existían.

La CI de PR y la corrida completa de main posterior al merge se registran en el PR y en la entrega final.
