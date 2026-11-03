## Approach
Inspeccionar el ZIP con descompresión incremental acotada antes de ExcelJS, contando bytes reales, entradas y complejidad de XML/merges. No confiar solo en tamaños declarados. Leer únicamente celdas presentes y materializar la grilla después de comprobar dimensiones con datos. Mantener padding vacío, fórmulas como texto y valores legítimos.

## Validation
Casos sintéticos de expansión, merges, padding y CSV; pruebas HTTP en DB descartable exclusiva; TypeScript y suites relacionadas con hasta dos workers. Sin builds, servicios remotos de negocio ni suite completa.

## Remaining work
Inventariar esquemas permisivos y cambios de contrato que requieran decisión; no endurecer globalmente sin verificar payloads del frontend.
