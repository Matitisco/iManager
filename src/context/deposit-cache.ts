/** A load that started before a refund must not paint the old credit back over it. */
export function depositLoadTicket(generations: Record<string, number>, clientId: string) {
  return generations[clientId] ?? 0;
}

export function noteDepositMutation(generations: Record<string, number>, clientId: string) {
  return { ...generations, [clientId]: (generations[clientId] ?? 0) + 1 };
}

export function depositLoadIsCurrent(generations: Record<string, number>, clientId: string, ticket: number) {
  return (generations[clientId] ?? 0) === ticket;
}
