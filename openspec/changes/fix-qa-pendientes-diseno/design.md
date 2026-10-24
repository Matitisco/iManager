## Decisions
Reutilizar Sheet y las clases existentes; retirar copy redundante manteniendo etiquetas, datos de color, explicación de conversión de precios, confirmaciones y errores funcionales. Cambiar tanto el recorte como el umbral del conteo a tres, sin alterar su expansión ni filtros.

En onboarding, asociar el error de cotización al input inválido mediante aria-invalid/aria-describedby. Tras renderizar el error, abrir los detalles y llevar scroll/foco al campo. Repetir en cada submit inválido, incluso con el mismo mensaje; mantener la validación y el guardado existentes.

## Validation
TypeScript frontend/backend en paralelo, tests de componentes relacionados (máximo dos workers), QA local antes/después a 1440×900 @1x y 390×844 @2x. Verificar scroll/foco, reenvío inválido, campos plegados y corrección válida. No build ni suite completa.
