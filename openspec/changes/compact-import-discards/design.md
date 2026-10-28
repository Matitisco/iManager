# Diseño

Reutilizar Sheet, subov, hist-screen, wlink, spill y los tokens de desk.css. El indicador vive junto al resumen, fuera de los avisos debajo de la tabla. La segunda hoja muestra un grupo por tipo de diagnóstico, cantidad y filas únicas ordenadas; si el backend no informa filas, indicarlo. Mantener el acceso a asignar Modelo.

La hoja principal usa el alto disponible del viewport; flex y min-height: 0 propagan el espacio hasta la tabla virtualizada. Tabla y panel tienen scroll interno; conservar encabezado y columna Modelo sticky. Móvil conserva el panel desplegable. Verificar 1440×900 y 390×844, foco, Escape y confirmación.
