## Why

iManager necesita cobrar suscripciones para comenzar a vender (#359), con un recorrido breve desde la prueba gratuita hasta el pago hospedado en Mercado Pago.

## What Changes

- Planes Básico/Negocio mensuales y anuales en USD, cobrados en ARS al blue vendedor del backend.
- Prueba sin tarjeta de siete días para cuentas nuevas; cuentas existentes internas gratis de por vida.
- Facturación para propietarios, contador de prueba, límites de miembros y solo lectura al vencer.
- Webhook autenticado cuando hay secreto, reconciliación consultando Mercado Pago y herramienta operativa de precios.
- Prisma únicamente aditivo, compatible con db push; sin exportaciones de filas.

## Capabilities

### New Capabilities
- `subscriptions`: ciclo de prueba, cobro, permisos y facturación de la tienda.

### Modified Capabilities
Ninguna; la capacidad de suscripciones agrega restricciones transversales sin reemplazar los contratos CRUD de cada módulo.

## Impact

Auth/onboarding, Store/User, invitaciones, Dashboard, Configuración, API y scripts del backend. Inventory, Sales, Clients y demás escrituras respetan la suscripción. No incorpora SDK ni otra pasarela.

## Non-goals

Creem/Rebill, checkout propio, facturas fiscales, exportación de filas y cobro de planes a medida.
