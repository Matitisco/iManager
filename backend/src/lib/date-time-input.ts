import { z } from 'zod';

/** Keep the API's Zod 3 ISO syntax: optional seconds and compact numeric offsets. */
export function dateTimeInput({ offset = false }: { offset?: boolean } = {}) {
  const date = z.regexes.date.source.slice(1, -1);
  const time = '([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d(\\.\\d+)?)?';
  const zone = offset ? '(Z|[+-]\\d{2}:?\\d{2})' : 'Z';
  return z.string().regex(new RegExp(`^${date}T${time}${zone}$`));
}
