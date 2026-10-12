## ADDED Requirements

### Requirement: Manual Android invitation
El sistema SHALL mostrar una tarjeta oscura al inicio de Dashboard en Android sin prompt nativo, después de 30 segundos con sesión lista, visible y sin overlays, respetando descarte persistente y modo standalone.

#### Scenario: Browser does not provide an installer
- **WHEN** Android no entrega beforeinstallprompt y transcurren 30 segundos elegibles
- **THEN** Dashboard muestra icono, «Instalá iManager», menú amarillo, instrucciones y cierre persistente

#### Scenario: Navigation without reload
- **WHEN** el banner manual está visible y el usuario sale de Dashboard
- **THEN** el banner desaparece y no se muestra en ninguna otra pantalla

### Requirement: Explicit mobile installation
El sistema SHALL mostrar una tarjeta amarilla como primera tarjeta de Más fuera de standalone, consumiendo el prompt nativo si existe o abriendo una hoja ilustrada.

#### Scenario: Manual guide
- **WHEN** el usuario toca Instalar sin prompt disponible
- **THEN** la hoja presenta beneficios, cuatro pasos de su plataforma con «Tu celular» y la otra plataforma colapsada

#### Scenario: Native installer
- **WHEN** existe beforeinstallprompt y el usuario toca Instalar
- **THEN** se abre el instalador una sola vez sin abrir la hoja

#### Scenario: First render of Más
- **WHEN** Más se monta en móvil fuera de standalone
- **THEN** la tarjeta tiene su espacio desde el primer render y no desplaza la ficha de perfil al tocar

#### Scenario: Installed app
- **WHEN** la aplicación está en standalone o se instala durante la sesión
- **THEN** ninguna entrada de instalación se muestra

### Requirement: Accessible platform guide
La hoja SHALL contener Safari, Compartir, Agregar a inicio y Agregar para iPhone; Chrome, menú, Instalar app o Agregar a pantalla principal e Instalar para Android, respetando safe areas, foco y scroll móvil.

#### Scenario: Alternate platform
- **WHEN** el usuario abre «¿Usás iPhone?» o «¿Usás Android?»
- **THEN** se muestran los cuatro pasos alternativos sin perder la guía principal

#### Scenario: First close tap
- **WHEN** el usuario toca la X una sola vez en iPhone
- **THEN** la guía cierra, restaura el foco y consume el gesto sin activar el fondo

### Requirement: Mobile update clearance
El toast de actualización SHALL ubicarse bajo la safe area superior en móvil, sin cubrir ninguna barra inferior y conservando su ubicación desktop. Una actualización pendiente SHALL recargar automáticamente al cerrar o guardar el formulario de forma segura.

#### Scenario: Pending update after a form
- **WHEN** el toast apareció durante una edición y el formulario se cierra o termina de guardar
- **THEN** la página recarga sin tocar Actualizar y sin interrumpir la persistencia
