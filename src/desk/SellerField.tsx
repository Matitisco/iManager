import { useAppContext } from '../context/AppContext';
import { ROLE_LABEL } from '../lib/roles';
import { DeskSelect } from './select';
import { Field } from './ui';

export function SellerField({ value, onChange, busy }: { value: string; onChange: (value: string) => void; busy?: boolean }) {
  const { commissionSellers = [] } = useAppContext();
  return <>
    <Field label="Vendedor"><DeskSelect label="Vendedor" sheetTitle="Elegir vendedor" value={value} onChange={onChange} disabled={busy}
      options={[{ value: '', label: 'Sin vendedor' }, ...commissionSellers.map(person => ({ value: person.id, label: `${person.name} · ${ROLE_LABEL[person.role]}` }))]} /></Field>
    <p className="eqs-note">Elegí quién hizo la venta. Sin vendedor, no suma comisión.</p>
  </>;
}
