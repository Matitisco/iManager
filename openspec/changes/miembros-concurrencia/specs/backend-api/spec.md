## ADDED Requirements

### Requirement: Mutaciones concurrentes de miembros conservan autorización y propietarios
El backend SHALL serializar cambios de rol y bajas por tienda, validar membresías activas dentro de la transacción y conservar al menos un OWNER activo.

#### Scenario: Bajas o degradaciones simultáneas de los últimos propietarios
- **WHEN** dos solicitudes concurrentes intentan degradar o remover a los últimos OWNER activos
- **THEN** al menos una se rechaza y la tienda conserva un OWNER activo

#### Scenario: Rol o permisos obsoletos
- **WHEN** el actor pierde su membresía o rol, o cambia el rol del objetivo antes de la mutación
- **THEN** la mutación evalúa los permisos actuales y no modifica miembros removidos

### Requirement: Aceptación concurrente y acceso revocado
El backend SHALL coordinar aceptación y bajas sin duplicar membresías y SHALL excluir miembros removidos al resolver acceso y activar tiendas.

#### Scenario: Aceptaciones simultáneas
- **WHEN** dos cuentas aceptan el mismo enlace o una cuenta acepta dos enlaces de la misma tienda simultáneamente
- **THEN** solo una aceptación se confirma y existe como máximo una membresía para esa cuenta y tienda

#### Scenario: Miembro removido
- **WHEN** se confirma una baja y el usuario vuelve a solicitar datos o activar la tienda
- **THEN** se rechaza el acceso a esa tienda hasta una reincorporación explícita válida
