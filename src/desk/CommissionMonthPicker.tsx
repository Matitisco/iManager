import { monthKey, monthLabel } from './commissions';
import { DeskSelect } from './select';
import { DeskIcon } from './ui';
export function CommissionMonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const now = monthKey();
  // Show the upcoming liquidation month so deductions can be reviewed after a cancellation.
  const [currentYear, currentMonth] = now.split('-').map(Number);
  const upcoming = monthKey(new Date(Date.UTC(currentYear, currentMonth, 15)), 'UTC');
  const latest = value > upcoming ? value : upcoming;
  const [year, month] = latest.split('-').map(Number);
  const options = Array.from({ length: 121 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 15));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = monthLabel(key).replace(' de ', ' ');
    return { value: key, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
  return <div className="commission-period"><DeskIcon name="cal" size={16} /><DeskSelect label="Mes de comisiones" sheetTitle="Mes de comisiones" value={value} options={options} onChange={onChange} /></div>;
}
