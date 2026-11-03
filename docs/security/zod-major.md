# Migración Zod 3 → 4

Backend: `^3.24.2` (lock 3.25.76) → `^4.6.7` (lock 4.6.7), última estable obtenida con `npm view zod version` el 2026-11-03. Raíz/frontend y landing no dependen de Zod: no se agregó una dependencia innecesaria.

Referencia: [guía oficial de migración](https://zod.dev/v4/changelog). Resuelve el pendiente de Zod de [headers/dependencias](headers-deps-pwa-front.md), incluida la alerta GHSA-mrhx-c7xc-m3w5. `npm --prefix backend audit` ya no reporta Zod ni alertas altas/críticas; quedan nueve moderadas ajenas a esta tarea.

## Cambios de compatibilidad

- `z.record` ahora declara claves string y conserva valores libres/nullable, incluidas estructuras de campos personalizados y props de eventos.
- El traductor español usa `origin` y los nuevos issues. Un error map global marca tipos/enums ausentes o null antes de que Zod omita el input; conserva los mensajes previos sin retener datos sensibles ni depender del texto inglés. Mensajes explícitos de cada schema tienen prioridad. Literales mantienen su error genérico anterior.
- Gastos usa el parámetro `error` conservando «Elegí pesos o dólares.». No cambian status ni las claves `statusCode`, `error`, `message`, `fields`.
- PATCH de reglas de comisión y definiciones personalizadas retiran defaults de creación: cambiar rate no modifica memberId/basis; renombrar no reinicia order. Se conservan los defaults al crear.
- `dateTimeInput` conserva la sintaxis ISO previamente admitida, incluidos segundos opcionales y offsets compactos. Usa el calendario de Zod 4 y la misma política UTC/offset de cada consumidor; no importa ni ejecuta `zod/v3`.
- `.refine(Number.isInteger)` conserva la semántica anterior de `.int()`: Zod 4 agrega un límite safe implícito que alteraría errores y rangos anteriores. Todos los mínimos/máximos y los `.safe()` explícitos preexistentes se conservan. El traductor también reconoce `origin: int` para estos últimos.
- El mapa de schemas analíticos declara sus tipos de salida con `ZodType`; se mantiene la allowlist y sanitización.

Se revisaron email, URL, unknown/any, coerce, default/transform, refine/superRefine, strict/passthrough, errores locales y tipos inferidos. No hay usos de uuid/nativeEnum, `.errors`, flatten/format, required_error/invalid_type_error ni integraciones fastify-type-provider-zod, zod-to-json-schema o resolvers con peers que migrar. Email conserva los formatos admitidos; strict/passthrough siguen soportados y mantienen su política. Los JSON Schemas manuales de importación no cambian.

## Verificación

Antes de actualizar: 73 pruebas backend relacionadas y 49 frontend aprobadas sobre Zod 3; 22 snapshots HTTP completos fijan contratos 400, incluidos errores anidados, null/ausentes, enums, dinero, longitudes y objetos estrictos. Al actualizar sin adaptar se reprodujeron regresiones de mensajes y defaults; después pasan sin regrabar esos snapshots.

Después: TypeScript/lint raíz y backend, 259 unitarias backend relacionadas, 49 frontend y 130 integraciones relacionadas con PostgreSQL exclusivo descartable `127.0.0.1:47809/zod_major_test` (máximo dos workers; integración secuencial). Regresiones de persistencia verifican PATCH de comisión y orden de campos personalizados, y la suite relacionada de lógica de negocio verifica números no finitos por HTTP. CI completa solicitada con `gh workflow run ci.yml --ref mejora/zod-major`; resultado y enlace en el PR.

Sin build local, suite completa local, acceso a producción, cambios de Prisma/schema, migraciones ni datos de negocio. Sin cambios visuales ni reversión de #691. No quedan bloqueos de peer dependencies ni cambios funcionales que requieran OK de Matias dentro de esta migración autorizada.
