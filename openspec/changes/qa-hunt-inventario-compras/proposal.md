# QA exploratorio inventario y compras

Auditar `origin/test` con datos sintéticos y PostgreSQL local exclusivo. El usuario autoriza tests y fixes chicos y seguros en `qa/hunt-inventario-compras`, con PR a `test`.

Corregir las inconsistencias de cantidad con IMEI vendido y del denominador de Inventario que incluye archivados. Documentar el cálculo de compras mayoristas como defecto abierto: cantidades adquiridas, remanentes e inversión necesitan una definición histórica que no se derive del stock mutable.

Sin build, producción, cambios de schema ni cambios a los permisos financieros STAFF de #691.
