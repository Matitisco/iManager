# iManager

Panel de gestión para negocios de dispositivos, con foco en inventario, ventas, clientes y canjes.

> Estado actual: **MVP usable con flujos core reales**, pero con varias pantallas auxiliares todavía mockeadas o incompletas.

> Coordinación viva:
> - `AGENTS.md` — handoff rápido entre agentes
> - `PROJECT_STATUS.md` — estado real, roadmap, issues y próximos pasos

---

## 1. Qué es iManager hoy

iManager no es el scaffold genérico que todavía sugieren algunos metadatos del repo.  
La implementación real es una app de gestión orientada a tiendas de celulares/dispositivos, especialmente útil para operar con:

- inventario por IMEI
- condición estética y salud de batería
- ventas
- clientes
- canjes / trade-ins
- columnas personalizadas para inventario

---

## 2. Stack verificado

- **Frontend:** React 19 + TypeScript + Vite 6
- **UI:** Tailwind CSS 4 + lucide-react + motion + recharts
- **Backend liviano/dev server:** Express + tsx (`server.ts`)
- **Auth:** Firebase Authentication
- **Base de datos:** Cloud Firestore
- **Reglas de seguridad:** `firestore.rules`

---

## 3. Estructura principal

### Frontend

- `C:\Users\matis\Desktop\iManager\src\App.tsx`  
  Shell principal de la aplicación y navegación por tabs.

- `C:\Users\matis\Desktop\iManager\src\context\AppContext.tsx`  
  Fuente de verdad de negocio: auth, suscripciones realtime y operaciones CRUD.

- `C:\Users\matis\Desktop\iManager\src\pages\`  
  Pantallas principales: dashboard, inventario, ventas, canjes, clientes, reportes, settings, notificaciones.

- `C:\Users\matis\Desktop\iManager\src\components\forms\`  
  Formularios de alta para inventario, clientes, ventas y canjes.

### Infra / configuración

- `C:\Users\matis\Desktop\iManager\src\firebase.ts`  
  Inicialización de Firebase.

- `C:\Users\matis\Desktop\iManager\firestore.rules`  
  Reglas de acceso y validación por colección.

- `C:\Users\matis\Desktop\iManager\server.ts`  
  Servidor Express para desarrollo y callback OAuth.

---

## 4. Auditoría funcional inicial

### Resumen ejecutivo

El proyecto mezcla **flujos core reales** con **capas de UI demo/mock**.

Eso significa:

- sí hay valor real para empezar a testear el producto
- pero NO todas las pantallas representan funcionalidad productiva
- varias vistas venden una madurez mayor a la implementación real

### Estado por módulo

| Módulo | Estado | Qué está real hoy | Riesgos / gaps detectados |
|---|---|---|---|
| Login | **Funcional** | Login con email/password y Google vía Firebase | Copy y branding bien; no se validó todavía un flujo real de recuperación de cuenta |
| Inventario | **Bastante funcional** | Alta, edición, borrado, filtros locales, columnas custom, persistencia en Firestore | KPIs/footer y paginación son visuales; formato moneda mezcla `en-US`; no hay búsqueda real |
| Ventas | **Parcialmente funcional** | Alta y borrado de ventas, actualización de stock a `VENDIDO`, actualización de gasto del cliente | Vistas/detalles con nombres e IMEI hardcodeados; editar venta tiene estados inválidos; borrar venta no revierte stock ni totales |
| Canjes | **Parcialmente funcional** | Alta, edición, borrado y persistencia en Firestore | Cards superiores y varios labels son demo; nombres de cliente hardcodeados en tabla; no hay workflow real de valuación |
| Clientes | **Funcional con maquillaje** | Alta y borrado reales, listado desde Firestore | KPIs son mock; filtros “activos/inactivos” usan lógica de ejemplo; no hay edición real implementada |
| Dashboard | **Demo con datos mezclados** | Lee `sales` del contexto para tabla parcial | KPIs, alertas, inventario por condición y evaluaciones están hardcodeados o derivados de forma incompleta |
| Reportes | **Mock** | Sin backend real asociado | Métricas, gráficos y exportación son demo |
| Notificaciones | **Mock** | UI interactiva local | No persiste ni consume eventos reales |
| Settings | **Mock** | Navegación interna de tabs | Store/profile/security/billing/integrations no persisten nada y muestran datos ficticios |
| Header / profile / mini notifications | **Mock** | Navegación y logout | Avatar, perfil y notificaciones rápidas usan datos falsos |

---

## 5. Flujos realmente valiosos para el primer tester

Si el objetivo es tener algo testeable YA, los recorridos más defendibles son:

1. **Autenticarse**
2. **Dar de alta productos**
3. **Editar productos**
4. **Crear clientes**
5. **Registrar ventas**
6. **Registrar canjes**
7. **Agregar / quitar columnas personalizadas en inventario**

Eso sí: el tester debería entrar sabiendo que **dashboard, reportes, settings y notificaciones no son evidencia de backend real todavía**.

---

## 6. Problemas importantes detectados para corregir antes o durante testing

### Bloqueantes o casi bloqueantes

1. **Ventas: edición con estado inválido**
   - En la UI de edición aparece `CANCELADA`
   - Pero el tipo `Sale.status` y las reglas de Firestore sólo contemplan `COMPLETADA` y `PENDIENTE`
   - Resultado probable: error al intentar guardar una venta cancelada

2. **Ventas: borrar no revierte efectos colaterales**
   - Al crear una venta se marca el producto como `VENDIDO`
   - También se suma `totalSpent` al cliente
   - Pero al borrar la venta NO se revierte ninguno de esos cambios

3. **Ventas: detalle visual engañoso**
   - La tabla y el panel lateral muestran clientes, productos e IMEI hardcodeados
   - Un tester puede creer que ve el dato real cuando en realidad ve placeholders

4. **Clientes y canjes: varias referencias nominales hardcodeadas**
   - Hay mapeos por ids tipo `1`, `2`, `3`
   - Si los documentos reales no coinciden con esos ids, la UI muestra nombres falsos

### No bloqueantes pero importantes

5. **Dashboard no representa el negocio real**
   - No debería usarse para validación operativa

6. **Reportes está en modo demo**
   - No debería ofrecerse como feature terminada

7. **Settings vende integraciones no verificadas**
   - Mercado Pago, WhatsApp, API propia, 2FA, billing y tokens aparecen en UI
   - Hoy no hay implementación visible que respalde esas promesas

8. **Formato de datos inconsistente**
   - Parte de la app usa `es-AR`
   - Parte formatea montos con `en-US`
   - La experiencia queda inconsistente para un tester regional

---

## 7. Seguridad y modelo de datos

Las reglas actuales de Firestore validan el shape de:

- `inventory`
- `sales`
- `tradeIns`
- `clients`
- `customColumns`

Además, usan `authorUid` y rol admin para acceso.

Esto es una buena señal:  
**la capa de datos está más seria que varias pantallas de UI**.

---

## 8. Cómo correr el proyecto

### Requisitos

- Node.js

### Instalar dependencias

```bash
npm install
```

### Variables de entorno

Tomar como base:

- `C:\Users\matis\Desktop\iManager\.env.example`

Variables relevantes:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- configuración Firebase incluida vía `firebase-applet-config.json`
- `VITE_API_BASE_URL` para apuntar al backend en Railway cuando ya esté desplegado

### Backend nuevo

El backend objetivo vive en `C:\Users\matis\Desktop\iManager\backend` y expone, al menos:

- `GET /api/health`
- `GET /api/me`

### Desarrollo

```bash
npm run dev
```

Esto levanta el servidor definido en `server.ts`.

### Chequeo de TypeScript

```bash
npm run lint
```

> Nota: en este proyecto `lint` ejecuta `tsc --noEmit`.  
> No hay tests automatizados propios detectados al momento de esta auditoría.

---

## 9. Recomendación para el primer tester

### Sí pedirle que pruebe

- login
- alta/edición de inventario
- alta de clientes
- registro de ventas
- registro de canjes
- columnas personalizadas

### No usar como criterio de “está terminado”

- dashboard
- reportes
- notificaciones
- settings
- integraciones
- billing

---

## 10. Próximo enfoque recomendado

Antes de pasar a una refactorización mayor, conviene resolver este orden:

1. sacar o etiquetar visualmente lo mock
2. corregir inconsistencias de ventas/clientes/canjes
3. alinear detalles visuales con datos reales
4. recién después encarar refactor de arquitectura/UI

Porque si no, vas a testear una casa con la fachada pintada y las vigas flojas.  
Y eso, hermano, es comprar deuda con intereses.
