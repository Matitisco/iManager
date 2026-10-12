## Decisions
Componente controlado DeskSelect con opciones value/label, combobox/listbox y selección explícita. Las flechas y Home/End cambian el foco activo; Enter/Espacio confirma; Escape y clic externo cancelan. Typeahead ignora acentos. Un select no visible conserva name, disabled y required para FormData y validación nativa; la validación enfoca el control visible.

El popup usa portal dentro de desk-app para conservar tokens y evitar recortes en cards/modales. Desktop calcula posición dentro del viewport y sigue scroll/resize. Mobile usa el breakpoint existente (760 px), dialog modal, safe areas, filas de 52 px, bloqueo del fondo y foco contenido. Escape cierra solo el selector antes del modal padre.

Reutilización acotada a Reportes y Configuración (moneda y cotización). Se conservan onboarding e importación para evitar ampliar el alcance a sus patrones de formularios.
