# sidenav Specification

## Purpose
TBD - created by archiving change wireframe-sidenav-acordeon. Update Purpose after archive.

## Requirements

### Requirement: Acordeón exclusivo
El menú SHALL permitir cero o un grupo abierto y SHALL mostrar destinos permitidos dentro del grupo.

#### Scenario: Cambiar de grupo
- **WHEN** se abre Stock y luego Análisis
- **THEN** Stock se cierra y solo Análisis expone sus destinos

#### Scenario: Abrir una ruta
- **WHEN** se abre una pantalla o se vuelve a ella mediante historial
- **THEN** su grupo se abre y su destino se indica con aria-current

### Requirement: Navegación sin islitas
El shell SHALL ofrecer las subsecciones en el menú, en escritorio y Más móvil, respetando permisos.

#### Scenario: Reportes y Resumen periódico
- **WHEN** se selecciona Resumen periódico desde Análisis
- **THEN** se muestra la pantalla existente sin chips de navegación y Atrás recupera Reportes

#### Scenario: Rol restringido
- **WHEN** un empleado no tiene Reportes ni Historial
- **THEN** no aparecen esos destinos ni Resumen periódico

### Requirement: Vistas y filtros accesibles
El menú SHALL ofrecer Reclamos y Patrones de Devoluciones, y Resumen y Equipos de Catálogo móvil. Los filtros de registros y las agrupaciones SHALL seguir operables en sus pantallas.

#### Scenario: Agrupar patrones
- **WHEN** se entra a Patrones desde Comercial y se elige Compra o Modelo
- **THEN** se consulta la agrupación existente y se conserva el acceso a Reclamos desde el menú

#### Scenario: Catálogo móvil
- **WHEN** se abre Más después de visitar Equipos del Catálogo
- **THEN** Stock está abierto y solo Equipos del Catálogo tiene aria-current

### Requirement: Teclado del acordeón
Los botones de grupo SHALL responder a Enter y Espacio sin navegar. Tab SHALL recorrer los controles visibles y omitir destinos de grupos cerrados.

#### Scenario: Recorrer un grupo
- **WHEN** se abre Stock con Enter y se pulsa Tab
- **THEN** el foco pasa a Equipos; al cerrar Stock, Tab pasa al siguiente grupo
