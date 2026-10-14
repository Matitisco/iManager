import { useAppContext } from '../context/AppContext';
import { fetchCommissionExchangeRate } from '../services/commissions-api';
import { useEffect, useState } from 'react';
import { houseFetchedAt, houseFromState, isFreshQuote, readBlueState, refreshExchangeQuote } from './blue-rate';

/** Payments always preload blue, even when the store displays MEP or a manual quote. */
export function useCommissionBlue() {
  const { user } = useAppContext();
  const cached = readBlueState();
  const [rate, setRate] = useState<number | null>(() => houseFromState(cached, 'blue')?.quote.sell ?? cached.quotes.dolarapi?.sell ?? null);
  const [error, setError] = useState('');
  useEffect(() => {
    const fetched = houseFetchedAt(readBlueState(), 'blue');
    if (fetched && isFreshQuote(fetched)) return;
    let active = true;
    void refreshExchangeQuote('blue').then(({ quote }) => { if (active) { setRate(quote.sell); setError(''); } }).catch(async () => {
      try { if (!user) throw new Error('Sin sesión'); const current = await fetchCommissionExchangeRate(user); if (active) setRate(current); }
      catch { if (active) setError('No se pudo actualizar el blue. Ingresá la cotización del pago.'); }
    });
    return () => { active = false; };
  }, []);
  return { rate, error };
}
