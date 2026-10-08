import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import {
  fetchCommissionPeriod,
  fetchCommissionPerson,
  markCommissionPaid,
  saveCommissionRule,
  type CommissionBasis,
  type CommissionPeriod,
  type CommissionPerson,
  type CommissionRuleView,
} from '../../services/commissions-api';
import {
  commissionPreview,
  paidLabel,
  parseCommissionRate,
  periodChoices,
  shareLabel,
} from '../commission-rule';
import { avatarTone, formatInputMoney, formatMoney, formatMoneyCompact, initials, parseMoney } from '../format';
import { Actions, DeskIcon, Field, MenuButton, Segs, useDesk } from '../ui';

const ROLE: Record<string, string> = { OWNER: 'Propietario', MANAGER: 'Socio', STAFF: 'Empleado' };
const BASES: { id: CommissionBasis; label: string }[] = [
  { id: 'PERCENT_SALE', label: '% sobre la venta' },
  { id: 'PERCENT_PROFIT', label: '% sobre la ganancia' },
  { id: 'FIXED_PER_DEVICE', label: 'Monto fijo por equipo' },
];
const VISIBLE_SALES = 6;

function fillFrom(rule: CommissionRuleView | null) {
  if (!rule) return { basis: 'PERCENT_SALE' as CommissionBasis, rateText: '3', includeAccessories: true };
  return {
    basis: rule.basis,
    rateText: rule.basis === 'FIXED_PER_DEVICE' ? formatInputMoney(rule.rate) : String(rule.rate).replace('.', ','),
    includeAccessories: rule.includeAccessories,
  };
}

export function CommissionsScreen() {
  const { user } = useAppContext();
  const { open, toast } = useDesk();
  const choices = useMemo(() => periodChoices(), []);
  const [periodKey, setPeriodKey] = useState(choices[0]?.key ?? '');
  const [data, setData] = useState<CommissionPeriod | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommissionPerson | null>(null);
  const [detailError, setDetailError] = useState('');
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleTarget, setRuleTarget] = useState('');
  const [basis, setBasis] = useState<CommissionBasis>('PERCENT_SALE');
  const [rateText, setRateText] = useState('3');
  const [includeAccessories, setIncludeAccessories] = useState(true);
  const [ruleError, setRuleError] = useState('');
  const [savingRule, setSavingRule] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !periodKey) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchCommissionPeriod(user, periodKey)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las comisiones'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, periodKey]);

  useEffect(() => {
    if (!user || !detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetchCommissionPerson(user, detailId, periodKey)
      .then((next) => { if (!cancelled) setDetail(next.person); })
      .catch((err: unknown) => { if (!cancelled) setDetailError(err instanceof Error ? err.message : 'No se pudo abrir el detalle'); });
    return () => { cancelled = true; };
  }, [user, detailId, periodKey, data]);

  useEffect(() => {
    if (!detailId && !ruleOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (ruleOpen) setRuleOpen(false);
      else setDetailId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailId, ruleOpen]);

  const selected = choices.find((item) => item.key === periodKey) ?? choices[0];
  const period = data?.period;
  const summary = data?.summary;
  const subtitle = period
    ? `${period.label} · ${period.current ? 'período en curso, cierra' : 'período cerrado'} el ${period.closesLabel}`
    : selected?.label;

  const openRule = (memberId: string | null) => {
    const target = memberId ?? '';
    const rule = target ? (data?.rules.personal[target] ?? data?.rules.team ?? null) : (data?.rules.team ?? null);
    const next = fillFrom(rule);
    setRuleTarget(target);
    setBasis(next.basis);
    setRateText(next.rateText);
    setIncludeAccessories(next.includeAccessories);
    setRuleError('');
    setRuleOpen(true);
  };

  const pay = async (memberId: string) => {
    if (!user || !data) return;
    setPayingId(memberId);
    setDetailError('');
    setError('');
    try {
      setData(await markCommissionPaid(user, { memberId, period: data.period.key }));
      toast('Comisión marcada como pagada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo marcar la comisión';
      if (detailId === memberId) setDetailError(message);
      else setError(message);
    } finally {
      setPayingId(null);
    }
  };

  const saveRule = async () => {
    if (!user) return;
    const rate = parseCommissionRate(basis, rateText);
    if (!(rate > 0)) {
      setRuleError(basis === 'FIXED_PER_DEVICE' ? 'Indicá el monto por equipo' : 'Indicá el porcentaje');
      return;
    }
    if (basis !== 'FIXED_PER_DEVICE' && rate > 100) {
      setRuleError('El porcentaje no puede pasar de 100');
      return;
    }
    setSavingRule(true);
    setRuleError('');
    try {
      setData(await saveCommissionRule(user, {
        memberId: ruleTarget || null,
        basis,
        rate,
        includeAccessories,
      }));
      setRuleOpen(false);
      toast('Regla guardada');
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : 'No se pudo guardar la regla');
    } finally {
      setSavingRule(false);
    }
  };

  const exportPeriod = () => {
    if (!data) return;
    const rows = [['Persona', 'Rol', 'Ventas', 'Monto vendido', 'Regla', 'Comisión', 'Estado']];
    data.people.forEach((person) => {
      rows.push([
        person.name,
        ROLE[person.role] ?? person.role,
        String(person.salesCount),
        String(person.soldAmount),
        person.rule ? `${person.rule.label} ${person.rule.detail}` : 'Sin regla',
        String(person.commission),
        person.paidAt ? paidLabel(person.paidAt) : 'Pendiente',
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comisiones-${data.period.key}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Comisiones exportadas');
  };

  const rate = parseCommissionRate(basis, rateText);
  const members = [...(data?.members ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'es'));
  const visibleSales = detail?.sales?.slice(0, VISIBLE_SALES) ?? [];
  const hiddenSales = Math.max(0, (detail?.sales?.length ?? 0) - VISIBLE_SALES);

  return (
    <div className="dscreen" data-testid="commissions-screen">
      <div className="dtop">
        <div>
          <h1>Comisiones</h1>
          <div className="dsub">{subtitle}</div>
        </div>
        <div className="dright">
          <MenuButton
            label={selected?.label ?? 'Período'}
            options={choices.map((item) => item.label)}
            value={selected?.label ?? ''}
            onChange={(label) => {
              const next = choices.find((item) => item.label === label);
              if (next) setPeriodKey(next.key);
            }}
          />
          <button className="dbtn s" type="button" onClick={exportPeriod} disabled={!data}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></svg>
            Exportar
          </button>
          <button className="dbtn p" type="button" onClick={() => openRule(null)}>
            <DeskIcon name="edit" size={16} />
            Reglas de comisión
          </button>
        </div>
      </div>

      {error ? <div className="ferr" style={{ marginBottom: 14 }}>{error}</div> : null}

      <div className="ckpis">
        <article className="ckpi">
          <div className="eyebrow">Vendido por el equipo</div>
          <div className="val">{formatMoneyCompact(summary?.soldAmount ?? 0)}</div>
          <div className="sub"><span className="ypill">{summary?.salesCount ?? 0} {(summary?.salesCount ?? 0) === 1 ? 'venta' : 'ventas'}</span></div>
        </article>
        <article className="ckpi">
          <div className="eyebrow">Comisiones del período</div>
          <div className="val">{formatMoney(summary?.commission ?? 0)}</div>
          <div className="sub">{shareLabel(summary?.share ?? 0)}</div>
        </article>
        <article className="ckpi">
          <div className="eyebrow">Ya pagado</div>
          <div className="val">{formatMoney(summary?.paidAmount ?? 0)}</div>
          <div className={`sub${summary?.paidCount ? ' ok' : ''}`}>{summary?.paidCount ?? 0} de {summary?.peopleCount ?? 0}</div>
        </article>
        <article className="ckpi">
          <div className="eyebrow">Pendiente de pago</div>
          <div className="val">{formatMoney(summary?.pendingAmount ?? 0)}</div>
          <div className="sub">a liquidar el {period?.closesLabel ?? '—'}</div>
        </article>
      </div>

      <div className="dcard flush">
        <div className="dch pad">
          <h3>Por vendedor y empleado</h3>
          <span className="mut">Clic en una persona para ver el detalle</span>
        </div>
        <div className="dtable-scroll">
          <table className="dtable">
            <thead>
              <tr>
                <th>Persona</th>
                <th className="r">Ventas</th>
                <th className="r">Monto vendido</th>
                <th>Regla</th>
                <th className="r">Comisión</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr className="static"><td colSpan={7} className="comm-empty">Cargando comisiones…</td></tr>
              ) : null}
              {!loading && data && data.people.length === 0 ? (
                <tr className="static"><td colSpan={7} className="comm-empty">Nadie registró ventas en este período.</td></tr>
              ) : null}
              {data?.people.map((person) => (
                <tr key={person.memberId} data-testid={`commission-row-${person.memberId}`} onClick={() => { setDetailError(''); setDetailId(person.memberId); }}>
                  <td>
                    <div className="dcell">
                      <div className={`av-c ${avatarTone(person.userId)}`}>{initials(person.name)}</div>
                      <div><b>{person.name}</b><small>{ROLE[person.role] ?? person.role}</small></div>
                    </div>
                  </td>
                  <td className="r">{person.salesCount}</td>
                  <td className="r">{formatMoney(person.soldAmount)}</td>
                  <td>{person.rule ? <><b>{person.rule.label}</b><small>{person.rule.detail}</small></> : <small>Sin regla</small>}</td>
                  <td className="r"><b>{formatMoney(person.commission)}</b></td>
                  <td>{person.paidAt ? <span className="paid">{paidLabel(person.paidAt)}</span> : <span className="spill lime">Pendiente</span>}</td>
                  <td className="r">
                    {person.paidAt ? (
                      <button className="cpay s" type="button" onClick={(event) => { event.stopPropagation(); setDetailId(person.memberId); }}>Ver</button>
                    ) : (
                      <button className="cpay" type="button" disabled={payingId === person.memberId} onClick={(event) => { event.stopPropagation(); void pay(person.memberId); }}>
                        {payingId === person.memberId ? 'Guardando…' : 'Marcar pagada'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {data && data.people.length > 0 ? (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="r">{summary?.salesCount ?? 0}</td>
                  <td className="r">{formatMoney(summary?.soldAmount ?? 0)}</td>
                  <td />
                  <td className="r">{formatMoney(summary?.commission ?? 0)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
      <p className="dhint">Las comisiones se calculan solas con las ventas registradas por cada persona. Una venta cancelada descuenta su comisión.</p>

      {detailId ? (
        <div className="ov" onMouseDown={() => setDetailId(null)}>
          <div className="sheet comm-sheet" role="dialog" aria-label={detail?.name ?? 'Detalle de comisión'} onMouseDown={(event) => event.stopPropagation()}>
            {detail ? (
              <>
                <div className="cperson">
                  <div className={`av-c ${avatarTone(detail.userId)}`}>{initials(detail.name)}</div>
                  <div>
                    <b>{detail.name}</b>
                    <small>{ROLE[detail.role] ?? detail.role} · {period?.label}</small>
                  </div>
                </div>
                <div className="cstats">
                  <div className="cstat"><span>Ventas</span><b>{detail.salesCount}</b></div>
                  <div className="cstat"><span>Monto vendido</span><b>{formatMoneyCompact(detail.soldAmount)}</b></div>
                  <div className="cstat hot"><span>Comisión</span><b>{formatMoney(detail.commission)}</b></div>
                </div>
                <div className="crule">
                  <div>
                    <small>Regla aplicada</small>
                    <b>{detail.rule ? `${detail.rule.label} · ${detail.rule.detail}` : 'Sin regla'}</b>
                  </div>
                  <button className="wlink" type="button" onClick={() => openRule(detail.memberId)}>Cambiar regla</button>
                </div>
                <table className="dtable compact">
                  <thead>
                    <tr><th>Venta</th><th>Equipo</th><th className="r">Accesorios</th><th className="r">Total</th><th className="r">Comisión</th></tr>
                  </thead>
                  <tbody>
                    {visibleSales.map((line) => (
                      <tr key={line.id} onClick={() => open({ type: 'sale', id: line.id })}>
                        <td><b>{line.code}</b><small>{line.date}</small></td>
                        <td>{line.device}</td>
                        <td className="r">{line.accessoriesAmount ? formatMoney(line.accessoriesAmount) : '—'}</td>
                        <td className="r">{formatMoney(line.total)}</td>
                        <td className="r"><b>{formatMoney(line.commission)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hiddenSales > 0 ? <div className="cmore">y {hiddenSales} {hiddenSales === 1 ? 'venta' : 'ventas'} más en el período</div> : null}
              </>
            ) : <p className="comm-empty">Cargando ventas…</p>}
            {detailError ? <div className="ferr">{detailError}</div> : null}
            <div className="sacts">
              <button type="button" className="btn2 s" style={detail?.paidAt ? { gridColumn: '1 / -1' } : undefined} onClick={() => setDetailId(null)}>Cerrar</button>
              {detail && !detail.paidAt ? (
                <button type="button" className="btn2 p" disabled={payingId === detail.memberId} onClick={() => void pay(detail.memberId)}>
                  {payingId === detail.memberId ? 'Guardando…' : `Marcar como pagada · ${formatMoney(detail.commission)}`}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {ruleOpen ? (
        <div className="ov" onMouseDown={() => { if (!savingRule) setRuleOpen(false); }}>
          <div className="sheet" role="dialog" aria-label="Regla de comisión" onMouseDown={(event) => event.stopPropagation()}>
            <h3>Regla de comisión</h3>
            <p className="sub">Define cuánto le corresponde a cada persona por sus ventas.</p>
            <Field label="Se aplica a">
              <select
                value={ruleTarget}
                onChange={(event) => {
                  const target = event.target.value;
                  const rule = target ? (data?.rules.personal[target] ?? data?.rules.team ?? null) : (data?.rules.team ?? null);
                  const next = fillFrom(rule);
                  setRuleTarget(target);
                  setBasis(next.basis);
                  setRateText(next.rateText);
                  setIncludeAccessories(next.includeAccessories);
                  setRuleError('');
                }}
              >
                <option value="">Todo el equipo</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </Field>
            <div className="fl">
              <span>Cómo se calcula</span>
              <Segs
                options={BASES}
                value={basis}
                onChange={(id) => {
                  const next = id as CommissionBasis;
                  if (next === 'FIXED_PER_DEVICE' && basis !== 'FIXED_PER_DEVICE') setRateText(formatInputMoney(15000));
                  if (next !== 'FIXED_PER_DEVICE' && basis === 'FIXED_PER_DEVICE') setRateText('3');
                  setBasis(next);
                  setRuleError('');
                }}
              />
            </div>
            <div className="frow">
              <Field label={basis === 'FIXED_PER_DEVICE' ? 'Monto por equipo' : 'Porcentaje'}>
                <input
                  value={rateText}
                  inputMode="decimal"
                  onChange={(event) => {
                    const next = basis === 'FIXED_PER_DEVICE'
                      ? formatInputMoney(parseMoney(event.target.value))
                      : event.target.value.replace(/[^\d,.]/g, '');
                    setRateText(next);
                    setRuleError('');
                  }}
                />
              </Field>
              <Field label="Se liquida">
                <select value="MONTHLY" disabled aria-label="Se liquida">
                  <option value="MONTHLY">Mensual</option>
                </select>
              </Field>
            </div>
            <label className="comm-check">
              <input type="checkbox" checked={includeAccessories} onChange={(event) => setIncludeAccessories(event.target.checked)} />
              Sumar los accesorios vendidos al cálculo
            </label>
            <div className="comm-preview">
              <span>Así quedaría</span>
              <b>{commissionPreview(basis, rate, includeAccessories)}</b>
            </div>
            <p className="comm-note">Si alguien tiene regla propia, reemplaza a la general. Los cambios aplican a las ventas desde hoy.</p>
            {ruleError ? <div className="ferr">{ruleError}</div> : null}
            <Actions primary="Guardar regla" onPrimary={() => { void saveRule(); }} onSecondary={() => setRuleOpen(false)} busy={savingRule} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
