# Cierre del diagnóstico deepmerge-ts / Prisma 6

## Resultado

Se aplica exclusivamente `@prisma/config@6.19.3 → deepmerge-ts@8.0.2` mediante un override npm. Prisma y @prisma/client permanecen en **6.19.3**. El backend pasa de 3 alertas altas a **0**, tanto en auditoría completa como `--omit=dev`. No es un backport ni un cambio de major de Prisma.

## Advisory y diferencia real entre versiones

[GHSA-ggr8-5vv4-36mx / CVE-2026-40345](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): severidad alta, versiones afectadas `<8.0.0`, primera versión parcheada **8.0.0**. Dos objetos que se referencian a sí mismos en la misma ruta provocan recursión sin límite. JSON plano no representa ese grafo cíclico.

Se eligió **8.0.2**, parche publicado por el proveedor, con requisito Node >=16.9.0 compatible con Node 22 del proyecto. [Cambios de 8.0.0](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0): combina profundamente valores de Map, cambia nombres de tipos y corrige mutaciones por alias en deepmergeInto. Estas diferencias impiden afirmar compatibilidad universal de 7→8. [8.0.2](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.2) corrige el requisito de Node.

## Por qué es acotado para este proyecto

- `@prisma/config@6.19.3/dist/index.js` tiene un único consumo: importa dinámicamente `deepmerge` y lo entrega a `c12.loadConfig` como `merger`.
- No consume `deepmergeInto`, constructores Custom, tipos renombrados ni entrypoints FastUnsafe.
- Prisma desactiva explícitamente la carga .env, rc, extensiones remotas, extensiones por defecto y package.json en ese camino. La configuración se compone de records y propiedades normales; el proyecto no tiene prisma.config propio, ni Maps personalizados de configuración.
- Se compararon cuatro casos ordinarios con ambas implementaciones: objetos anidados de schema/migrations, arrays de tablas y flags experimentales, callback adapter y valores undefined. Los resultados fueron idénticos.
- Se comprobó también una diferencia: dos Maps con el mismo key y records distintos reemplazan el valor en v7 y lo combinan en v8. Esa superficie no es usada aquí. No se promete equivalencia para futuras configuraciones con Maps.
- El override está limitado al **padre exacto 6.19.3** y fija 8.0.2; no se aplica indiscriminadamente a otras dependencias ni futuras versiones de Prisma. Revisarlo al actualizar Prisma y retirarlo cuando el proveedor resuelva oficialmente el pin.

## Evidencia reproducible

Se agregó `backend/src/test/prisma-config-security.test.ts`, que resuelve deepmerge desde el módulo de Prisma y corre automáticamente en la suite unitaria/CI.

```sh
cd backend
npm run test:unit -- src/test/prisma-config-security.test.ts --maxWorkers=1
npm run lint
npm run build
npm run test:unit -- --maxWorkers=2
# DATABASE_URL debe apuntar exclusivamente a una base local de pruebas:
npm run test:integration
npm audit --json
npm audit --omit=dev --json
npm ls deepmerge-ts prisma @prisma/client --all
```

**Rojo/verde real:** con 7.1.5 pasaron 4 pruebas de compatibilidad y fallaron exactamente las 2 del advisory (`deepmerge` y `deepmergeInto`) con `RangeError: Maximum call stack size exceeded`. Con 8.0.2 pasaron **6/6**. Las restantes verifican merge ordinario sin mutar entradas, configuración ausente, carga TypeScript mediante Prisma/c12 con resolución de paths y rechazo de configuración inválida.

Generación real de Prisma Client **6.19.3** aprobada en el build habitual y mediante `prisma generate --config /tmp/.../prisma.config.ts`, usando el schema del repositorio y un archivo temporal con schema/migrations. `prisma validate --config` también aprobado. No se ejecutó `npm start` ni sincronización de facturación.

Node usado: **22.23.3**. TypeScript/build backend aprobados; **516 pruebas unitarias** aprobadas (510 existentes + 6 nuevas). **322 integraciones aprobadas** sobre PostgreSQL 16 local, puerto 55432, base `imanager_security_test`. Después se reinstaló con `npm ci`: 6/6 regresiones aprobadas de nuevo y `prisma db execute --stdin --schema prisma/schema.prisma` ejecutó `SELECT 1` correctamente contra esa base. Auditorías finales completa/producción: 0/0.

## Riesgos comprobados y potenciales

**Comprobado:** la versión 7.1.5 instalada podía desbordar la pila con el grafo del advisory. La versión 8.0.2 evita ese fallo y mantiene los casos ordinarios de configuración probados. El cambio de semántica de Map también se comprobó.

**No comprobado:** explotación desde HTTP en iManager o un incidente en producción. No se encontró una ruta desde cuerpos de peticiones a ese merge de configuración. No se verificó el despliegue en Railway ni se usaron datos/credenciales de producción.

**Riesgo potencial residual del override:** está fuera del pin exacto publicado por Prisma. Nuevos usos de Map, callbacks avanzados o futuras versiones del padre requieren otra revisión. Las pruebas cubren los caminos actuales, no todas las configuraciones imaginables. No se cambia el major de Prisma y no se necesita migración de schema.

La recomendación es conservar este override acotado con su regresión automática y revisar el CI antes de aprobar el PR. No se recomienda una migración mayor solo para resolver este advisory.

## CI revisado

La revisión con override `00158bf` aprobó generación/instalación, TypeScript, 516 unitarias y 322 integraciones en ambos CI. Los runs finales fallaron en cinco E2E con selectores de navegación preexistentes. La evidencia y la corrección acotada de pruebas están en [el informe general](README.md#seguimiento-de-ci-y-selectores-preexistentes). Cada nueva revisión debe completar su propio CI antes del merge; no se declara verde una ejecución anterior ni una pendiente.
