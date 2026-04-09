# Trade-ins Import Fixtures

Archivos `.xlsx` pensados para probar robustez del importador de Canjes.

## Archivos

- `01-tradeins-import-validos-con-variaciones.xlsx`
  Casos mayormente validos con fechas variadas, montos decimales y `batteryHealth` en formatos distintos.

- `02-tradeins-import-mixto-errores.xlsx`
  Filas con cliente inexistente, campos obligatorios vacios y numeros invalidos.

- `03-tradeins-import-duplica-y-upsertea.xlsx`
  Repite el mismo `deviceReceivedImei` para probar el comportamiento de update/upsert.

- `04-tradeins-import-headers-confusos.xlsx`
  Headers alternativos para probar el auto-mapeo por `mapHints`.

- `05-tradeins-import-formatos-extremos.xlsx`
  Espacios extra, fechas raras, comas decimales, estados en minuscula y valores ambiguos.

## Nota

Las filas exitosas requieren que existan clientes con esos nombres en la store actual:

- `Juan Perez`
- `Ana Gomez`
- `Carlos Lopez`

Si no existen, esas filas deberian fallar con error de cliente no encontrado, lo cual tambien sirve para validar robustez.

## Regenerar

```bash
node scripts/generate-tradeins-import-fixtures.mjs
```
