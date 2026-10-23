/** Complete a real TAC with a synthetic six-digit serial and its check digit. */
export function testImei(tac: string, serial = '123456'): string {
  const base = tac + serial;
  if (!/^\d{14}$/.test(base)) throw new Error('Expected an eight-digit TAC and six-digit serial');
  const sum = [...base].reduce((total, character, index) => {
    const digit = Number(character) * (index % 2 === 1 ? 2 : 1);
    return total + (digit > 9 ? digit - 9 : digit);
  }, 0);
  return base + ((10 - sum % 10) % 10);
}
