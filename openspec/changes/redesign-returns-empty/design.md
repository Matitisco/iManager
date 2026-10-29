# Diseño

Devoluciones conserva ScreenTitle, filtros y estados de carga/error. El vacío usa una sección sin card, borde ni sombra, ícono RotateCcw de lucide-react de 24 px, h2 16/800, descripción 14/500 y botón btn2 p de 52 px. Tokens de desk.css y DM Sans; padding 64/20 desktop y 40/16 mobile. La descripción y el título se adaptan a Todos, Activos y Archivados. En vacío se omiten la acción de cabecera y el MobileDock para que Nuevo reclamo tenga un único foco; con registros o durante carga/error se mantienen.

Las capturas se generan con la app real y API interceptada con datos ficticios, sin backend ni base de producción, sin watchers ni build. La descripción solicitada por el usuario y la ausencia de borde tienen prioridad sobre R1/R24 de la guía para este estado puntual.
