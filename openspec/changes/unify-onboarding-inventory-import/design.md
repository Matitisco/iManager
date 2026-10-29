# Diseño

Extraer del host de Inventario el flujo compartido `ImportFlow`: catálogo de campos, definiciones personalizadas, análisis/reaplicación, consulta de IMEI activos/archivados y persistencia. `ImportHost` conserva la integración con navegación, recargas y avisos del escritorio. El onboarding usa el mismo `ImportFlow` con callbacks de progreso y resultado para conservar sus pasos y salida resiliente. No agregar endpoints ni lógica de transformación al onboarding.

La vista previa y las reglas de un equipo por fila, duplicados y conservación de datos siguen siendo las del importador existente. Un error de persistencia no completa el onboarding. Las recargas posteriores a persistencia no obligan a repetir escrituras.
