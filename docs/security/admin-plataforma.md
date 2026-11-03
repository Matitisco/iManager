# Seguridad — admin-plataforma

2026-11-03. Entrega: [PR #721](https://github.com/Matitisco/iManager/pull/721), `sec/admin-plataforma` → `test`.

## Corregido

| Severidad | Reproducción local y fix | OK de Matías |
|---|---|---|
| Media | Los cinco POST admin parseaban bodies antes de autorizar; JSON inválido anónimo daba 400. Import/restore admiten 16 MiB: procesamiento evitable expuesto a visitantes. Ahora todo el plugin autentica/autoriza en `onRequest`, antes del parser (401/403). No se intentó provocar saturación/caída. | No |
| Media | Restore devolvía 200 con `categoryId`, `supplierId` o `stockPurchaseId` de otra tienda; verificar solo el `storeId` de la fila no aísla sus FK. Lectores de inventario incluyen metadatos de proveedor/compra. Requiere admin de plataforma. Ahora valida esas referencias con locks dentro de Serializable, antes de escribir: 409 y snapshot completo intacto. Backups válidos y catálogos archivados siguen restaurándose exactamente. | No |

## Pendiente

Riesgos operativos observados en código; no se ejecutaron scripts sobre datos reales.

| Severidad | Pendiente y motivo | OK de Matías |
|---|---|---|
| Media | Reset admite cualquier entorno sin membresía del admin, por contrato explícito (`docs/admin/store-reset.md`). Conserva OWNER activo, nombre/ID exactos, conteos, rollback y aislamiento. Definir bloqueo de producción/allowlist cambia la herramienta operativa. | Sí: operación/datos |
| Media | `scripts/seed-reports-demo.ts` usa un usuario fijo/tienda por defecto y borra/recrea fixtures sin confirmar ID/entorno. Scripts de agrupado usan heurísticas de host/entorno; restore CLI tiene menos guardas que HTTP. Acordar política local explícita y confirmación de ID antes de cambiar comandos operativos. | Sí: datos/herramientas |
| Baja | Duplicados registra «Agrupado automático» sin identidad admin; restore elimina esos eventos sin agregar uno propio. Los tests exigen recuperar la auditoría previa exactamente. Definir un registro admin durable separado; import/correcciones/reset sí registran email admin. | Sí: historial/retención |
| Baja | `verifyIdToken` verifica firma/expiración sin consultar revocación/usuario deshabilitado en cada request. Decidir verificación adicional solo para plataforma y su dependencia de disponibilidad/latencia de Firebase. | Sí: acceso |

## Validación

- PostgreSQL exclusivo descartable `qa_sec_admin_plataforma`, loopback y puerto aleatorio >20000; usuarios `qa-sec-<n>@example.com`. Listener y requests HTTP reales para health/rechazos/superficies inexistentes. Identidad sintética mediante el bypass existente exclusivo de test; sin Firebase real ni credenciales.
- Ocho regresiones rojas antes del fix: cinco respuestas 400 en vez de 401 y tres 200 en vez de 409. **180 integraciones relacionadas (15 nuevas), 44 unitarias relacionadas y TypeScript frontend/backend aprobados.** Interrupciones por inodos agotados resueltas moviendo solo recursos propios y repitiendo los archivos afectados.
- Revisados allowlist, stats/listados/historial, import/reset/correcciones/restore, health, Mercado Pago y scheduler. Allowlist vacía deniega; exige email verificado y comparación sin distinguir mayúsculas. No hay rutas registradas de impersonación/debug/metrics/swagger/docs ni cron HTTP con secreto compartido.
- Webhook existente: HMAC con comparación constante, secreto obligatorio, timestamp ±5 minutos, acuerdo ID body/query y reconciliación contra proveedor bajo lock. Replay vuelve a reconciliar idempotentemente; no activa billing desde el body. Tests con mocks, sin red al proveedor.
- Sin build, cambios de schema/migraciones, producción ni alteraciones de #691. Tests existentes conservados.
