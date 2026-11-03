# Diseño

Investigación estática: `Sale.amount` es `Decimal(12,2)` (`backend/prisma/schema.prisma`); `operations.service.ts` guarda `dec(input.amount)` y serializa con `toNum`. `moneyInput` admite dos decimales y solo normaliza a centavos. El formulario interpreta decimales con `parseMoney` y envía el importe sin redondearlo a entero.

`formatMoney` usa cero decimales por defecto; `ExchangeProvider` lo comparte entre Ventas y Dashboard. Cambiar su precisión de presentación predeterminada para USD a dos y completar la segunda cifra en fracciones. Las proyecciones usadas exclusivamente para texto también deben conservar centavos USD. Mantener las APIs numéricas, inputs, escrituras y agregaciones existentes sin cambios. El detalle ya solicita precisión dos y reutiliza el mismo helper.

Validar helper y componentes desktop/móvil con Vitest, incluyendo ARS, enteros, negativos y conversión de visualización. No consultar bases de datos.
