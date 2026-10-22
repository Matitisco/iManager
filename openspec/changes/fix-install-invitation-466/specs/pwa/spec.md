## Purpose
Ofrecer instalación móvil con una invitación única, descartes claros y una guía accesible permanentemente desde Ayuda.

## ADDED Requirements

### Requirement: Single Dashboard invitation
El sistema SHALL mostrar una única invitación blanca sólo en Dashboard móvil después de 30 segundos continuos de sesión habilitada, pestaña visible, sin instalación, descarte vigente ni formulario/modal visible. SHALL retirarla inmediatamente y reiniciar la espera al perder elegibilidad. Sustituye Manual Android invitation de install-help y la invitación de add-installable-pwa.

#### Scenario: Navigation and forms
- **WHEN** se navega fuera de Dashboard, se oculta la pestaña o se abre un formulario/modal local o global
- **THEN** la invitación desaparece inmediatamente y requiere otros 30 segundos elegibles para reaparecer

#### Scenario: Platform guide
- **WHEN** transcurren 30 segundos elegibles
- **THEN** Android con prompt ofrece Instalar app, Android sin prompt muestra pasos manuales, Safari muestra Compartir y Agregar a inicio, y otro navegador iOS indica abrir en Safari

#### Scenario: Installed or desktop
- **WHEN** se detecta display-mode standalone, navigator.standalone, appinstalled o escritorio incluso angosto
- **THEN** no se muestra invitación automática ni tarjeta móvil

### Requirement: Meaningful installation preferences
El sistema SHALL ofrecer Ahora no y No volver a mostrar como acciones separadas. SHALL conservar preferencias por origen, migrar descartes históricos, sincronizar componentes y pestañas y admitir almacenamiento bloqueado.

#### Scenario: Seven-day snooze
- **WHEN** se toca Ahora no o se descarta el prompt nativo
- **THEN** el banner se oculta siete días exactos, el aviso confirma el aplazamiento y Más/Ayuda conservan acceso

#### Scenario: Permanent dismissal
- **WHEN** se toca No volver a mostrar
- **THEN** banner y tarjeta de Más desaparecen, Primeros pasos remite a Ayuda sin alterar progreso y el aviso señala únicamente Ayuda

#### Scenario: Expiry in an open session
- **WHEN** vence el aplazamiento con la app abierta o al volver a la pestaña
- **THEN** se recalcula elegibilidad y comienza la espera de 30 segundos

### Requirement: Explicit mobile installation
El sistema SHALL conservar la tarjeta amarilla en su lugar actual de Más únicamente para móviles no instalados y sin descarte permanente; Ayuda SHALL conservar siempre la guía con el subtítulo Siempre disponible, aunque hayas ocultado la invitación. Sustituye Explicit mobile installation de install-help.

#### Scenario: Native prompt outcomes
- **WHEN** el usuario toca Instalar con prompt disponible, incluso uno recibido tarde
- **THEN** el evento se consume una sola vez, accepted no acredita instalación real, dismissed aplaza siete días y un error permite instrucciones manuales visibles

#### Scenario: Help after dismissal
- **WHEN** se abre la guía desde Ayuda después del descarte permanente
- **THEN** la guía permanece accesible sin restablecer preferencias y conserva foco, cierre táctil y pasos alternativos
