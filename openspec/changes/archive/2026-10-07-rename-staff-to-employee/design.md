## Context

El frontend usa mapas locales y etiquetas inline para mostrar los roles. STAFF está persistido y enviado a la API como identificador; el nombre visible es independiente.

## Decisions

- Reemplazar las etiquetas de STAFF por Empleado en los componentes existentes, sin agregar abstracciones para este cambio de texto.
- Conservar STAFF en valores de formularios, contratos y comprobaciones de permisos.
- Incluir las etiquetas anteriores Vendedor cuando identifican al mismo rol y la referencia de búsqueda de ventas.

## Validation

- Buscar referencias restantes a Agente y a etiquetas anteriores del rol en `src/`.
- Ejecutar las pruebas existentes de Login, Onboarding, Settings y StoreSwitcher.
- Ejecutar TypeScript del frontend y backend en paralelo, sin build local.
