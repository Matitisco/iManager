# Catálogo configurable por permisos — #376

Catálogo requiere publicCatalog explícito para Empleados/Socios y permanece habilitado para el propietario. Los defaults legacy y los perfiles Vendedor/Técnico no lo conceden; Todo sí. La fila reutiliza el ícono store y los estilos existentes, sin resaltado amarillo. El menú conserva list; Más lo ubica primero y la barra inferior lo excluye.

El backend aplica requireSectionAccess a las rutas de administración y conserva la auditoría. Regenerar el enlace y cambiar active de un catálogo existente requieren OWNER. La validación de active ocurre dentro de la transacción, serializada por tienda; crear el catálogo inicial está permitido. El empleado edita reglas/visibilidad y guarda sin active. Getting-started y validación de secciones aceptan el mismo permiso. Sin cambios del schema de Prisma.

Validación local aprobada:

| Comando | Resultado |
| --- | --- |
| npm run lint | TypeScript frontend/E2E aprobado (tsc --noEmit) |
| npm --prefix backend run lint | TypeScript backend aprobado (tsc --noEmit) |
| npm run test:frontend | 131 archivos, 949 tests |
| npm --prefix backend run test:unit | 64 archivos, 460 tests |
| npm --prefix backend run test:integration | 32 archivos, 286 tests |
| npm run build | Aprobado; aviso de tamaño del bundle |
| Playwright catalog-permissions.spec.ts | 2 escenarios Chromium aprobados |

Integraciones: PostgreSQL local imanager_test. Capturas: instancia local con autenticación de prueba, datos sintéticos en imanager_376_e2e y puertos 4276/3176; sin acceso a producción. El spec está desactivado salvo que ISSUE_376_SHOTS indique una carpeta. Para reproducir con la configuración habitual de Playwright y una base local de pruebas:

```bash
ISSUE_376_SHOTS=docs/pr-shots npm run test:e2e -- e2e/catalog-permissions.spec.ts
```

| Captura | Tamaño |
| --- | --- |
| [Permisos desktop](pr-shots/376-permisos-1440.png) | 1440×900 |
| [Permisos mobile](pr-shots/376-m-permisos.png) | 390×844, escala 2, full page |
| [Más mobile](pr-shots/376-m-mas.png) | 390×844, escala 2 |
| [Catálogo empleado desktop](pr-shots/376-catalogo-empleado-1440.png) | 1440×900 |
| [Catálogo empleado mobile](pr-shots/376-m-catalogo-empleado.png) | 390×844, escala 2 |
| [Acceso denegado desktop](pr-shots/376-sin-acceso-1440.png) | 1440×900 |

Se inspeccionaron las seis imágenes contra los mockups: orden, columnas, íconos, subtítulo, switches, navegación y acciones del sheet. Diferencias deliberadas: fila sin amarillo y empleado sin Catálogo activo/Desactivar/Regenerar. Se preservan los elementos actuales de la aplicación (Ayuda, vista previa y acciones de compartir); las capturas del navegador no agregan la barra de estado del sistema operativo. Los datos locales mantienen 24 visibles, cinco ocultos por reglas y dos manualmente. Sin cambios de estilos.

Cambios en sections/team-permissions, MemberPermissions/PublicCatalogScreen y sus pruebas; backend stores/sections, section-access, public-catalog y getting-started, con pruebas unitarias e integración; spec E2E, documentación y capturas. OpenSpec permanece en changes/catalog-member-permissions según la convención activa del repositorio. Sin commit ni push.
