## Approach
Reutilizar Sheet y DeskSelect, con portal dentro de desk-app para conservar tema y evitar recortes del selector. Estado local adding; campos vacíos y tipo requerido para la nueva tienda. currentKind se deriva como el opuesto del tipo elegido.

Extender enable con otherAddress y otherInstagram opcionales, normalizando contacto antes de crear el grupo y guardando los datos de la nueva tienda en la misma transacción. Activar el id recién creado y aplicar la sesión devuelta. Conservar el id si falla la activación para reintentar sin repetir el alta; reflejar la sesión con el grupo ya creado ante ese error.

Mantener EnableStoreGroupCard sin cambios. Usar los estilos existentes de Sheet sin modificar el selector D1 ni la pill móvil.

## Validation
Tests del selector y sheet en desktop/móvil; validación, permisos, creación, selección, errores y reintento. Unitarias de enableSchema e integración local aislada de store-groups. TypeScript frontend/backend; sin build ni navegador.
