## Why

iManager necesita cobrar suscripciones para comenzar a vender (#359), con un recorrido breve desde la prueba gratuita hasta el pago con tarjeta dentro de iManager mediante Secure Fields de Mercado Pago.

## What Changes

- Planes Básico/Negocio mensuales y anuales en USD, cobrados en ARS al blue vendedor del backend.
- Prueba sin tarjeta de siete días para cuentas nuevas; cuentas existentes internas gratis de por vida.
- Facturación para propietarios, contador de prueba, límites de miembros (Básico 3, Negocio/prueba 5, interno ilimitado) y solo lectura al vencer.
- Webhook autenticado cuando hay secreto, reconciliación consultando Mercado Pago y herramienta operativa de precios.
- Prisma únicamente aditivo, compatible con db push; sin exportaciones de filas.

## Capabilities

### New Capabilities
- `subscriptions`: ciclo de prueba, cobro, permisos y facturación de la tienda.

### Modified Capabilities
Ninguna; la capacidad de suscripciones agrega restricciones transversales sin reemplazar los contratos CRUD de cada módulo.

## Impact

Auth/onboarding, Store/User, invitaciones, Dashboard, Configuración, API y scripts del backend. Inventory, Sales, Clients y demás escrituras respetan la suscripción. Incorpora MercadoPago.js para tokenizar tarjetas, sin otra pasarela.

## Non-goals

Creem/Rebill, facturas fiscales, exportación de filas y cobro de planes a medida.
