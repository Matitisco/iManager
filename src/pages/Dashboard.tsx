import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { RefreshCw, ShoppingCart, Smartphone, Wallet } from 'lucide-react';
import {
  clientName,
  formatMoney,
  formatMoneyCompact,
  isOpenTradeIn,
  productLabel,
  salesInPeriod,
  statusLabel,
} from '../mobile/logic';

interface Checks {
  inv: boolean;
  ven: boolean;
  cj: boolean;
}

const CHECKS_KEY = 'im-mobile-checks';

function readChecks(): Checks {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CHECKS_KEY) ?? '') as Partial<Checks>;
    return { inv: !!parsed.inv, ven: !!parsed.ven, cj: !!parsed.cj };
  } catch {
    return { inv: false, ven: false, cj: false };
  }
}

const FLOW: { key: keyof Checks; title: string }[] = [
  { key: 'inv', title: 'Revisá ingresos o cambios en inventario' },
  { key: 'ven', title: 'Registrá ventas y canjes a medida que ocurren' },
  { key: 'cj', title: 'Si algo no cierra, avisá o dejá feedback' },
];

export const Dashboard: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { appSession, sales, tradeIns, inventory, clients } = useAppContext();
  const [checks, setChecks] = useState<Checks>(readChecks);
  const welcomeName = appSession?.user.displayName?.trim() || 'equipo';
  const done = FLOW.filter((step) => checks[step.key]).length;
  const monthSales = salesInPeriod(sales, 'Mes');
  const monthTotal = monthSales.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
  const available = inventory.filter((item) => item.status === 'DISPONIBLE').length;
  const openTrades = tradeIns.filter((trade) => isOpenTradeIn(trade.status));
  const pendingBalance = clients.reduce((sum, client) => sum + (Number(client.pendingBalance) || 0), 0);
  const debtors = clients.filter((client) => client.pendingBalance > 0).length;
  const recentSales = [...sales].slice(0, 5);
  const recentTrades = openTrades.slice(0, 4);

  const toggle = (key: keyof Checks) => {
    setChecks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      sessionStorage.setItem(CHECKS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-5 text-[#16181D]">
      <div>
        <p className="text-sm font-medium text-[#737984]">Hola, {welcomeName}</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">
          ¿Qué hay para <span className="bg-[linear-gradient(transparent_62%,#DDF43B_62%,#DDF43B_88%,transparent_88%)]">hoy</span>?
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <section className="rounded-[24px] border border-[#E6E8EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_4px_14px_rgba(0,0,0,.05)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-[#F5FBD7] px-2.5 py-1 text-xs font-extrabold">+ Tu turno</span>
            <span className="text-sm font-extrabold text-[#737984]">{done}/3</span>
          </div>
          <h2 className="text-xl font-extrabold">Flujo sugerido</h2>
          <p className="mt-1 text-sm font-medium text-[#737984]">Una guía rápida para arrancar el turno. El progreso queda en este dispositivo.</p>
          <div className="mt-4 space-y-2">
            {FLOW.map((step) => (
              <button
                key={step.key}
                type="button"
                onClick={() => toggle(step.key)}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-[#F7F8FA]"
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${checks[step.key] ? 'border-[#25A66A] bg-[#25A66A] text-white' : 'border-[#D5D8DE]'}`}>
                  {checks[step.key] ? '✓' : ''}
                </span>
                <span className={`text-sm font-semibold ${checks[step.key] ? 'text-[#737984] line-through' : ''}`}>{step.title}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs font-bold text-[#737984]">
            <span>{done}/3</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ECEDEF]">
              <span className="block h-full rounded-full bg-[#DDF43B]" style={{ width: `${(done / 3) * 100}%` }} />
            </span>
            <span>{done === 3 ? 'listo' : `faltan ${3 - done}`}</span>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <StatButton
            icon={<ShoppingCart size={16} />}
            label="Ventas del mes"
            value={formatMoneyCompact(monthTotal)}
            detail={`${monthSales.length} ventas`}
            onClick={() => onNavigate?.('sales')}
          />
          <StatButton
            icon={<Smartphone size={16} />}
            label="En stock"
            value={`${inventory.length} equipos`}
            detail={`${available} disponibles`}
            onClick={() => onNavigate?.('inventory')}
          />
          <StatButton
            icon={<RefreshCw size={16} />}
            label="Canjes en curso"
            value={String(openTrades.length)}
            detail={`${tradeIns.length} en total`}
            onClick={() => onNavigate?.('tradeins')}
          />
          <StatButton
            icon={<Wallet size={16} />}
            label="Saldos a cobrar"
            value={formatMoneyCompact(pendingBalance)}
            detail={`${debtors} clientes`}
            onClick={() => onNavigate?.('clients')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-[24px] border border-[#E6E8EC] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Ventas recientes</h2>
            <button type="button" className="text-sm font-bold underline" onClick={() => onNavigate?.('sales')}>Ver todas</button>
          </div>
          {recentSales.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#E6E8EC] px-4 py-8 text-center text-sm font-semibold text-[#737984]">No hay ventas recientes.</p>
          ) : (
            <div className="divide-y divide-[#E6E8EC]">
              {recentSales.map((sale, index) => {
                const product = inventory.find((item) => item.id === sale.productId);
                return (
                  <div key={sale.id || index} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                    <div>
                      <div className="font-bold">{clientName(clients, sale.clientId)}</div>
                      <div className="text-[#737984]">{productLabel(product)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold">{formatMoney(Number(sale.amount) || 0)}</div>
                      <div className="text-xs font-bold text-[#25A66A]">{statusLabel(sale.status)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-[#E6E8EC] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Canjes en curso</h2>
            <button type="button" className="text-sm font-bold underline" onClick={() => onNavigate?.('tradeins')}>Ver todos</button>
          </div>
          {recentTrades.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#E6E8EC] px-4 py-8 text-center text-sm font-semibold text-[#737984]">No hay canjes en curso.</p>
          ) : (
            <div className="space-y-3">
              {recentTrades.map((trade, index) => (
                <div key={trade.id || index} className="rounded-2xl border border-[#E6E8EC] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold text-[#737984]">
                    <span>{trade.date || 'Sin fecha'}</span>
                    <span className="rounded-full bg-[#F7F8FA] px-2 py-0.5">{statusLabel(trade.status)}</span>
                  </div>
                  <div className="text-sm font-bold">{clientName(clients, trade.clientId)}</div>
                  <div className="text-sm text-[#737984]">Recibido: {trade.deviceReceived || 'Equipo'}</div>
                  <div className="mt-1 text-right text-sm font-extrabold">{formatMoney(Number(trade.differencePaid) || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

function StatButton({
  icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[22px] border border-[#E6E8EC] bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,.04)] hover:bg-[#F7F8FA]"
    >
      <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[#F7F8FA] text-[#16181D]">{icon}</span>
      <span className="block text-[11px] font-extrabold uppercase tracking-wide text-[#737984]">{label}</span>
      <span className="mt-1 block text-2xl font-extrabold tracking-tight">{value}</span>
      <span className="mt-1 block text-xs font-semibold text-[#737984]">{detail}</span>
    </button>
  );
}
