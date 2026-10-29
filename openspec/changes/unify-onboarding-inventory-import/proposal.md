# Unificar importación de stock del onboarding

El onboarding mantiene una configuración y callbacks propios del importador. Esto permite divergencias de campos, mapeo, vista previa y advertencias respecto de Inventario.

Reutilizar un único flujo de importación desde ambos accesos, con los mismos endpoints y reglas por fila. Mantener el paso de stock, cancelación, finalización y analítica del onboarding. Validar únicamente con un Excel sintético y guardar evidencia antes/después en `/workspace/qa-onb-import/`.
