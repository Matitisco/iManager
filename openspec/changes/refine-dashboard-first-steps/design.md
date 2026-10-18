# Diseño

- Extraer el contenido compartido del dashboard; conservar la condición actual de cuenta nueva y sus datos reales.
- Reutilizar las cajas vacías con los textos y acciones aprobados. Eliminar únicamente CSS del dashboard fresh sin consumidores.
- Corregir especificidad de botones, separar pseudo-elementos progress por navegador, usar panel de 360px y píldora móvil de 52px.
- Persistir el cierre por usuario y tienda en localStorage, sin escrituras de DB. Una transición observada a 5/5 muestra «Listo · 5/5» cuatro segundos; si ya estaba completo al cargar, ocultar inmediatamente.
- Validar con Vitest, TypeScript, build y, si está disponible, capturas locales con datos simulados.
