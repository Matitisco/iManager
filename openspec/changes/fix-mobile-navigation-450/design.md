# Diseño

Historial con identificador propio por entrada en history.state, conservando campos ajenos. Posiciones y filtros solo en memoria y separados por usuario/tienda/permisos. Una entrada nueva inicia `.stage` en cero en layout effect. Atrás/Adelante recuperan su entrada; Volver desde Más usa el historial cuando existe ese origen y tiene fallback a Más para enlaces directos. Alias conservan query y metadata al canonicalizar. Cambios de estado, datos y overlays no disparan el reset. Restauración pendiente por altura observa contenido y termina al alcanzar la posición o ante interacción del usuario.

Un contexto efímero de navegación conserva únicamente estado de presentación explícito de las tres listas y paginación; no guarda datos de negocio, selección ni formularios. Los componentes siguen desmontándose al navegar. Nueva visita por navegación explícita recibe estado inicial. Un modal sobre la lista no desmonta ni reinicia su estado.

Cada contador tiene una descripción de sus componentes no nulos: avisos sin leer en Inventario/Ventas/Clientes, canjes en curso, órdenes abiertas, seguimientos para hoy, comisiones pendientes y notificaciones sin leer. Se usa la misma función para lateral, barra, pestañas y filas de Más. Un texto plegable en el grupo permite ver la explicación con toque, teclado o lector. Se mantienen etiquetas, agrupación y permisos.

Las acciones secundarias se agrupan en un disclosure nativo en listas móviles. La selección se inicia allí; al activarla sus controles quedan visibles. La barra de acciones masivas ocupa el espacio sobre navegación, con altura medida para reservar el área de scroll. Se conserva la infraestructura de modales de #447 y filtros de #449.

Validación con tests de navegación real y componentes, suites frontend/backend e integración PostgreSQL local. Fixture automatizado aislado para evidencias antes/después a 320/390/1440 px; no despliegue local completo ni sesión productiva. Registrar versión HTTP servida sin caché y límites de evidencia.
