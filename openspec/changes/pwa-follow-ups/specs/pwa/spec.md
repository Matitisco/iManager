## ADDED Requirements

### Requirement: Auth configurable y caché pública
El sistema SHALL mantener el dominio Firebase actual sin variable y permitir un dominio propio configurado con proxy de helpers. Nunca SHALL cachear API ni /__/.

#### Scenario: Sin configuración nueva
- **WHEN** no existe VITE_FIREBASE_AUTH_DOMAIN
- **THEN** el login existente conserva su dominio y flujo.

### Requirement: Instalación por plataforma
El sistema SHALL separar el descarte iOS/Android y ofrecer screenshots wide/narrow reales en el manifest.

#### Scenario: Descarte histórico de guía
- **WHEN** existe el flag compartido histórico
- **THEN** se migra a iOS y Android conserva su acción de instalación.

### Requirement: Actualizaciones seguras
El sistema SHALL activar versiones nuevas y navegar network-first con fallback offline, recargando solamente sin edición pendiente.

#### Scenario: Actualización durante un formulario
- **WHEN** cambia el controller mientras un formulario/modal está abierto
- **THEN** el contenido se conserva, aparece un toast y la recarga espera el cierre seguro.

### Requirement: Interacciones móviles accesibles
El sistema SHALL mostrar foco de marca solamente con focus-visible y consumir el clic del backdrop del selector antes de cerrarlo.

#### Scenario: Cierre desde el backdrop
- **WHEN** se toca el backdrop sobre la navegación
- **THEN** se cierra el sheet al clic sin cambiar la pestaña ni la selección.
