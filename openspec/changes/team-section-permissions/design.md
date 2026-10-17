# Diseño

Conservar OWNER/Propietario, MANAGER/Socio y STAFF/Empleado. Socio sólo gestiona Empleados ajenos. Preview público discriminado por status; invitación guarda invitedById nullable con fallback al propietario. Aceptación transaccional con locks y vencimiento. STAFF persiste defaults explícitos. Reportes sólo utiliza módulos autorizados. Catálogos filtran por sección. UI reutiliza el design system desk y el sheet existente, siguiendo .mockups-71.
