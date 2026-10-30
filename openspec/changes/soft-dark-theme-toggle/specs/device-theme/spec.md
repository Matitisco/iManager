## ADDED Requirements

### Requirement: Interruptor rápido de tema
El sistema SHALL ofrecer botones Tema claro y Tema oscuro en la fila de usuario desktop y el título Más móvil, con aria-pressed y persistencia en imanager-theme. Automático SHALL permanecer disponible solo en Configuración.

#### Scenario: Preferencia automática
- **WHEN** el sistema cambia de tema con preferencia Automático
- **THEN** el interruptor refleja el tema resuelto y al pulsar un botón fija esa preferencia explícita

### Requirement: Diseño oscuro suave y navegación compacta
El sistema SHALL usar la paleta cálida aprobada exclusivamente en oscuro y conservar las funciones de cotización y las secciones del menú.

#### Scenario: Navegación desktop y móvil
- **WHEN** se abre la aplicación
- **THEN** desktop muestra la cotización en una línea con refresco y detalle, y Más agrupa perfil/invitación con divisor y muestra la navegación sin card contenedora
