## Why
La importación descomprime XLSX antes de validar tamaño, expansión y estructura. Una planilla pequeña puede agotar recursos del navegador/API. Revisar además entradas y sinks de inyección, XSS y SSRF con datos sintéticos locales.

## What Changes
- Bloqueo de contaminación de prototipos mediante rangos nombrados XLSX.
- Límites previos al parser XLSX y lectura acotada de la grilla; límite de bytes CSV.
- Regresiones rojo/verde y requests contra PostgreSQL local exclusivo.
- Corregir solo vulnerabilidades confirmadas de alcance mínimo; documentar validación transversal pendiente.

## Impact
Frontend y backend comparten protección de importación. Sin schema, migraciones, cambios monetarios ni cambios a #691. Rama de seguridad y PR hacia test, autorizado por el usuario.
