## Datos existentes y completitud

`classifyClose` conserva snapshot esperado y resultados históricos. `scanCount` cuenta IMEI no repetidos, incluidos sobrantes y vendidos: compararlo con la cantidad esperada NO prueba completitud. `missing` contiene esperados no escaneados salvo los vendidos durante el conteo, que se clasifican aparte. `matched` puede incluir ingresos posteriores al inicio. No existe un indicador que certifique haber recorrido todo el local.

Presentación derivada, sin alterar clasificación:
- `scanCount === 0`: Sin escaneos, con aviso explícito de que faltantes no confirman pérdidas.
- Con escaneos y `missing.length > 0`: Conteo con equipos sin escanear, cantidad de IMEI distintos registrados y esperados sin escanear, revisión antes de confirmar.
- Con escaneos y sin missing: Sin faltantes en la comparación. No se afirma completitud física; vendidos/sobrantes conservan su revisión.
- `excludedNoImei`: bloque separado con cantidad, alcance excluido y aclaración de que no se considera faltante.

## Selección y confirmación

`showClosed` vacía ambas selecciones. Cambiar efectivamente de grupo vacía ambas; pulsar el grupo actual no altera selección. Solo propietario/socio autorizado puede seleccionar o resolver. La acción del grupo envía únicamente la selección visible: Archivar N equipos seleccionados / Cargar N equipos seleccionados. Con cero se deshabilita.

La acción abre el Sheet compartido, sin escribir. Muestra cantidad, listado con IMEI completos, motivo fijo Faltante (archivo) o alta Disponible pendiente de completar (sobrantes). Aclara que el control queda ajustado y los demás equipos no se modifican; conserva la resolución única actual. Cancelar no llama API. El envío bloquea cierre y doble envío; error visible dentro del Sheet conserva selección y permite reintentar. Registrar no modifica inventario, incluso con selección.

## Validación

Pruebas de apertura/reapertura/cambio de control/grupo, selección explícita, confirmación/cancelación, payload aislado, permisos, fallo, doble envío, estados sin escaneos/parcial/sin faltantes y excluidos. Suites completas frontend/backend e integraciones solo en `127.0.0.1/imanager_test`; sin despliegue local completo. Estilos adaptables a 390 px y 1440 px; Sheet compartido con scroll y footer para alturas cortas.
