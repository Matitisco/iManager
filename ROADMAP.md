# iManager — Roadmap & Issues

> Fuente de verdad para el backlog del producto.
> Orden cronológico de trabajo, organizado por fases y milestones.

---

## Regla general de prioridades

```
Fase 1 — Inventario + Motor de tablas
  ↓
Fase 2 — Aplicar el motor al resto de módulos (Sales, Clients, Trade-ins)
  ↓
Fase 3 — Completar el MVP (Settings, Reports, multi-usuario, entornos)
  ↓
Fase 4 — Post-MVP (fuera del MVP, contemplado para el futuro)
```

---

## Milestones

| Hito | Fase | Objetivo |
|------|------|----------|
| **M1 · Inventory Polish & Table Engine** | 1 | Pulir inventario al máximo y extraerlo como motor reutilizable |
| **M2 · Aplicar motor al resto de módulos** | 2 | Sales, Clients y Trade-ins usan el mismo motor |
| **M3 · MVP — Primera Tienda** | 3 | Sistema completo listo para el primer usuario real |
| **M4 · Post-MVP** | 4 | Features secundarias, no bloquean el MVP |

---

## Objetivo MVP

> Dejar el producto listo para que lo pruebe la primera tienda:
> **Dashboard · Inventario · Ventas · Clientes · Canjes · Reportes + Configuración + Permisos multi-usuario**

---

## Fase 1 — Inventario Polish & Table Engine `M1`

### #1 🔴 `fix(inventory): column rename not reflected in Sort panel`
**Labels:** `inventory` `bug`

Cuando se renombra una columna (doble click en el header), el Sort panel sigue mostrando el nombre original hardcodeado. Verificar también que el rename persista correctamente tras un reload.

**Criterios de aceptación:**
- Sort panel lee el nombre de columna de la misma fuente que el header
- El rename persiste correctamente en reload
- Sin nombres de columna hardcodeados en el Sort panel

---

### #2 🔴 `feat(inventory): Excel-like inline editing — remove edit modal`
**Labels:** `inventory` `ux` `enhancement`

Reemplazar el flujo actual (modal de edición) por edición inline en cualquier celda de la tabla, al estilo Excel pero con la estética de iManager. La edición debe sentirse fluida y nativa.

**Criterios de aceptación:**
- Doble click en cualquier celda la pone en modo edición in-place
- Tab / Enter confirma y avanza a la siguiente celda
- Escape cancela sin guardar
- Los cambios persisten inmediatamente vía API
- No se requiere modal para ediciones estándar de campos

---

### #3 🔴 `feat(inventory): right-click context menu — add row / add item`
**Labels:** `inventory` `ux` `enhancement`

Extender el menú contextual (clic derecho) existente para incluir la opción de agregar un nuevo ítem directamente desde la tabla, sin navegar fuera.

**Criterios de aceptación:**
- Clic derecho en la tabla muestra el context menu
- Opción "Agregar ítem" abre una fila inline vacía o un quick-add form
- El nuevo ítem se guarda en base de datos
- Las opciones existentes del context menu se mantienen

---

### #4 🔴 `feat(inventory): drag selected items to category — count badge + confirmation`
**Labels:** `inventory` `ux` `enhancement`

Los ítems seleccionados (multi-select ya implementado) deben ser arrastrables como grupo. Al arrastrar: badge flotante con el número de ítems seleccionados siguiendo el cursor. Al soltar en una pestaña de categoría: diálogo de confirmación antes de ejecutar el cambio.

**Criterios de aceptación:**
- Selección múltiple con checkboxes → el grupo es draggable
- Badge flotante muestra el conteo de ítems mientras se arrastra
- Las pestañas de categoría se iluminan como drop targets válidos
- Al soltar: confirmación "¿Mover N ítems a [Categoría]?"
- On confirm: items reasignados vía API, tabla se actualiza sin reload completo

---

### #5 🟡 `feat(inventory): animations when moving items between categories`
**Labels:** `inventory` `ux` `enhancement`

Agregar animaciones significativas cuando los ítems cambian de categoría (individual o bulk). El feedback visual debe ser claro y alineado con el estilo de iManager.

**Criterios de aceptación:**
- Ítems animan al salir de la vista de la categoría actual
- Ítems animan al aparecer en la nueva categoría
- Animaciones suaves, no intrusivas
- Funciona en moves individuales y bulk

---

### #6 🔴 `feat: global search bar — inventory, sales, trade-ins and clients`
**Labels:** `search` `ux` `enhancement`

Activar la barra de búsqueda actual para filtrar ítems en tiempo real en cada módulo según los campos más relevantes.

**Criterios de aceptación:**
- Inventory → nombre, IMEI, modelo, marca
- Clients → nombre, teléfono, email
- Sales → nombre de cliente, producto
- Trade-ins → dispositivo, nombre de cliente
- Resultados se actualizan en tiempo real mientras se escribe

---

### #7 🟡 `feat(inventory): export table data to Excel / CSV`
**Labels:** `inventory` `enhancement`

Botón de exportación en el toolbar de inventario. Descarga los datos visibles como `.xlsx` o `.csv`, respetando los filtros y columnas activas.

**Criterios de aceptación:**
- Botón de exportación en el toolbar de inventario
- Exporta solo las columnas visibles (respeta el toggle de columnas)
- Exporta los datos filtrados/ordenados actualmente visibles
- Formato `.xlsx` (y opcionalmente `.csv`)
- Nombre de archivo: `inventory_YYYY-MM-DD.xlsx`

---

### #8 🔴 `refactor: extract inventory table into reusable table engine`
**Labels:** `table-engine` `enhancement`

Extraer todas las features de la tabla de inventario en un componente/motor genérico y reutilizable. Este es el pilar arquitectónico para escalar el producto a otros módulos y proyectos.

**Features a extraer:** inline edit · resize/reorder/rename de columnas · drag-to-category · bulk select · search · sort · filter · export · context menu · paginación

**Criterios de aceptación:**
- Componente `<TableEngine>` (o similar) configurable vía props/config
- Todas las features de inventario soportadas genéricamente
- Desacoplado de lógica de dominio de inventario
- Puede usarse en otros módulos con configuración mínima
- Sirve de base para otros proyectos

---

## Fase 2 — Aplicar el motor al resto de módulos `M2`

### #9 🔴 `feat: apply table engine to Sales, Trade-ins and Clients`
**Labels:** `table-engine` `enhancement`
**Prerrequisito:** #8

Una vez extraído el motor de tablas, aplicarlo a los tres módulos core restantes. Cada módulo hereda todas las features del motor sin reimplementación.

**Criterios de aceptación:**
- Tabla de Sales usa table engine
- Tabla de Clients usa table engine
- Tabla de Trade-ins usa table engine
- Campos y acciones específicas de cada dominio se mantienen
- Todas las features del motor funcionan en los 3 módulos

---

## Fase 3 — MVP — Primera Tienda `M3`

### #10 🔴 `feat: Settings — profile editing and store configuration`
**Labels:** `settings` `enhancement`

Construir la sección de Configuración con funcionalidad real: edición de perfil de usuario y edición de datos de la tienda. Persistir cambios en PostgreSQL.

**Criterios de aceptación:**
- Edición de nombre, email y avatar del usuario
- OWNER puede editar nombre, dirección y contacto de la tienda
- Cambios persisten en base de datos
- Validación de campos requeridos

---

### #11 🔴 `feat: multi-user store — members, roles and permissions`
**Labels:** `settings` `multi-user` `backend` `enhancement`

Habilitar múltiples usuarios por tienda. Toda la data de negocio se asocia al `storeId`, no al usuario individual. El OWNER gestiona los miembros y sus roles.

**Roles mínimos:** `OWNER` · `MANAGER` · `STAFF`

**Criterios de aceptación:**
- OWNER puede invitar usuarios por email
- Usuario invitado se une a la tienda en el próximo login (o al aceptar)
- OWNER puede cambiar roles y remover miembros
- Toda la data está siempre scoped a `storeId`
- STAFF no accede a configuración ni gestión de miembros
- Lista de miembros visible en Settings

---

### #12 🟡 `feat: build Reports section with real SQL data`
**Labels:** `enhancement`

Reemplazar el placeholder de Reportes con datos reales de PostgreSQL. Foco en los reportes más útiles para una tienda de celulares.

**Criterios de aceptación:**
- Reportes consultan datos reales del backend
- Al menos: resumen de ventas por período, valor de inventario, top productos
- Filtro por rango de fechas
- Gráficos y/o tablas con números reales

---

### #13 🔴 `chore: configure production and development environments`
**Labels:** `infrastructure` `enhancement`

Separar Railway en dos environments: `dev` y `prod`. Dev permite experimentar sin afectar al primer usuario real. Bases de datos separadas, env vars separadas, pipelines separados.

**Criterios de aceptación:**
- Rama `dev` despliega a Railway dev environment
- Rama `main` despliega a Railway prod environment
- Base de datos separada por entorno
- Variables de entorno configuradas por entorno

---

### #19 🔴 `test: comprehensive test coverage — frontend, backend and E2E`
**Labels:** `testing` `enhancement`

Escribir tests para absolutamente todo el sistema: lógica de backend (unit + integration), endpoints de la API, componentes de frontend y flujos críticos end-to-end. Sentar la base para que cualquier cambio futuro sea seguro de deployar.

**Scope:**
- **Backend (unit):** services, helpers, lógica de negocio (sales, inventory, trade-ins, clients)
- **Backend (integration):** endpoints de la API con base de datos real (ya hay base con Vitest)
- **Frontend (unit):** hooks, utils, funciones de transformación
- **Frontend (component):** componentes críticos (TableEngine, modales, formularios)
- **E2E:** flujos completos — login, onboarding, crear venta, agregar ítem, canje

**Criterios de aceptación:**
- Cobertura ≥ 80% en lógica de backend
- Tests de integración para todos los endpoints de la API
- Tests de componente para TableEngine y módulos core
- Al menos un test E2E por flujo crítico (login, venta, inventario, canje)
- CI corre todos los tests en cada push

---

### #16 🔴 `chore: Railway architecture review for scaling to 50–100+ stores`
**Labels:** `infrastructure` `enhancement`

Revisar la arquitectura de Railway para soportar 50-100 tiendas concurrentes antes de abrir el producto a más usuarios. Evaluar connection pooling, read replicas, caching y horizontal scaling.

**Criterios de aceptación:**
- Análisis de carga documentado
- Connection pooling configurado (PgBouncer o Prisma Accelerate)
- Plan de escalado horizontal definido
- SLAs documentados (uptime objetivo, latencia máxima)
- Plan de migración si se requieren cambios arquitectónicos

---

## Fase 4 — Post-MVP `M4`

> Estas features están contempladas pero **no bloquean el MVP**. No estarán disponibles para el primer usuario piloto.

---

### #14 🟢 `feat: notification engine — types, triggers and UI`
**Labels:** `post-mvp` `enhancement`

Diseñar e implementar el sistema de notificaciones: tipos (bajo stock, nueva venta, nuevo cliente, etc.), triggers desde el backend, y UI (campana en header con panel de notificaciones).

**Nota:** Mantener en dev únicamente hasta después del MVP.

**Criterios de aceptación:**
- Tipos de notificaciones definidos y documentados
- Backend emite notificaciones en eventos clave
- Campana en el header con conteo de no-leídas
- Panel de notificaciones recientes
- Funcionalidad de marcar como leído

---

### #15 🟢 `feat: two-factor authentication (2FA) via Firebase MFA`
**Labels:** `post-mvp` `enhancement`

Implementar 2FA usando Firebase Multi-Factor Authentication. Activable por el usuario desde la sección de Configuración.

**Criterios de aceptación:**
- On/off configurable en Settings
- Soporte para TOTP (app autenticadora) y/o SMS
- 2FA requerido en login desde dispositivo nuevo

---

### #17 🟢 `feat: payment gateway and subscription module`
**Labels:** `post-mvp` `enhancement`

Implementar un sistema de suscripciones para las tiendas que usen iManager. Integrar pasarela de pago (Stripe recomendado), definir tiers de plan y gatear features según el plan activo.

**Criterios de aceptación:**
- Planes de suscripción definidos y documentados
- Pasarela de pago integrada (Stripe)
- Estado de suscripción del store trackeado en BD
- Features gateadas por plan
- Gestión de billing disponible en Settings

---

### #18 🟢 `chore: Integrations section — dev only, hidden in production`
**Labels:** `post-mvp` `infrastructure`

La sección de Integraciones existe en la UI pero no tiene funcionalidad. Ocultarla o marcarla como "Próximamente" en producción. Disponible en dev para experimentación. No bloquea el MVP.

**Criterios de aceptación:**
- Sección oculta o "coming soon" en producción
- Disponible en dev para experimentación
- Sin cambios que rompan otras features al deshabilitarla

---

## Resumen ejecutivo

| # | Issue | Fase | Prioridad |
|---|-------|------|-----------|
| 1 | fix: column rename no se refleja en Sort | M1 | 🔴 Alta |
| 2 | feat: inline editing Excel-like, sin modal | M1 | 🔴 Alta |
| 3 | feat: right-click → agregar ítem | M1 | 🔴 Alta |
| 4 | feat: drag items seleccionados → categoría | M1 | 🔴 Alta |
| 5 | feat: animaciones al mover ítems | M1 | 🟡 Media |
| 6 | feat: barra de búsqueda global | M1 | 🔴 Alta |
| 7 | feat: export a Excel / CSV | M1 | 🟡 Media |
| 8 | refactor: extraer motor de tablas | M1 | 🔴 Alta |
| 9 | feat: aplicar motor a Sales, Clients, Trade-ins | M2 | 🔴 Alta |
| 10 | feat: Settings — perfil y configuración de tienda | M3 | 🔴 Alta |
| 11 | feat: multi-usuario — miembros, roles y permisos | M3 | 🔴 Alta |
| 12 | feat: Reportes con datos reales | M3 | 🟡 Media |
| 13 | chore: entornos prod y dev | M3 | 🔴 Alta |
| 16 | chore: arquitectura Railway escalable | M3 | 🔴 Alta |
| 19 | test: cobertura completa — backend, frontend y E2E | M3 | 🔴 Alta |
| 14 | feat: motor de notificaciones | M4 | 🟢 Baja |
| 15 | feat: autenticación de dos factores (2FA) | M4 | 🟢 Baja |
| 17 | feat: pasarela de pago y suscripciones | M4 | 🟢 Baja |
| 18 | chore: sección Integraciones solo en dev | M4 | 🟢 Baja |
