# Diseño

Agregar `toUserMessage` compartido y hacer que el helper existente delegue en él. Normalizar rechazos de fetch sin perder nombres necesarios para reintentos; distinguir el timeout del controlador. Normalizar HTTP 5xx antes de leer el body y mantener status y mensajes 4xx en español. Usar el helper en errores visibles del contexto, formularios, notificaciones e importador, incluida la pantalla de error global.

Verificar con Vitest las variantes Chrome/Safari/Firefox, offline, timeout, HTTP y reintentos. Ejecutar lint, build, unitarios, E2E y PWA, repitiendo fallos de iPhone antes de concluir.
