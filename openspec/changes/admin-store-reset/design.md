## Decisiones
- Dos arrays explícitos clasifican todos los modelos Prisma. DMMF obliga a decidir para futuros modelos con storeId e hijos de datos borrables.
- Rechazar production antes de parsear el body o abrir una transacción; exigir STORE_RESET_ALLOWED_STORE_IDS con el id exacto antes de acceder a la DB. Lista ausente/vacía implica 403. Middleware authenticate + requirePlatformAdmin.
- Resolver por storeId y validar nombre exacto y email de OWNER activo (case insensitive).
- Contar todas las tablas, incluidos NotificationRead y modelos preservados. Token determinístico VACIAR <id> <total>. Aplicación requiere igualdad exacta del mapa expect, sin claves faltantes ni adicionales.
- Tanto preview como aplicación borran hijos antes que padres y verifican las postcondiciones. Preview revierte mediante excepción interna. Serializable, timeout 120s, lock_timeout 10s.
- Conservar StoreCounter y reiniciar lastSaleNumber/lastTradeNumber/lastRepairNumber en cero: el próximo comprobante será 1. No reiniciar secuencias globales.
- Conservar definiciones de CashRegister, reiniciar balance en cero. El resto de campos de configuración queda intacto.
- Verificar conteos y fingerprints de todas las otras tiendas, agrupados por storeId (incluyendo analytics sin tienda y NotificationRead); detectar cascadas y SetNull. Verificar todas las cuentas, tiendas, miembros y configuración por fingerprint de filas.
- Conservar auditoría previa y agregar store.reset/source system al final de la transacción con conteos e identidad del admin. No atribuir al OWNER ni loguear body/respuesta.
- BillingPlan e ImeiTacMiss son globales y se conservan por precaución. No hay modelos tenant sin decisión clara.

## Validación
Fixtures con datos en todas las tablas borrables y preservadas, dos tiendas, filas archivadas, usuarios sin tienda, analytics globales, snapshot completo antes/después. Casos de auth, ambiente, contrato, expect/token, idempotencia y relaciones cruzadas malformadas. Solo PostgreSQL de test local autorizado; TypeScript/lint y los tres archivos de integración pedidos, máximo dos workers, sin builds.
