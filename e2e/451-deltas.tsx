import { createRoot } from 'react-dom/client';
import { ReportVariation } from '../src/desk/screens/ReportsScreen';
import { reportDelta } from '../src/desk/report-metrics';
import '../src/desk/desk.css';
const comparison = 'los 30 días anteriores';
const cases = [
  ['Sube, es bueno', reportDelta(112, 100, comparison), 'Facturación, presupuestado y comisiones generadas.'],
  ['Baja, es malo', reportDelta(40, 100, comparison), 'La misma métrica cayendo; flecha y texto indican la dirección.'],
  ['Sin juicio', reportDelta(18, 15, comparison, 'count'), 'Stock, canjes y nuevos clientes: diferencia absoluta y tono gris.'],
  ['Sin cambio', reportDelta(100, 100, comparison), 'Cero variación: igual al período anterior.'],
  ['Sin base', reportDelta(10, 0, comparison), 'Sin registros anteriores: no mostramos 100 %.'],
  ['Sin cotización', reportDelta(10, null, comparison), 'La ausencia de una conversión no se convierte en cero.'],
  ['Variación pequeña', reportDelta(999.99, 1000, comparison), 'Conservamos la dirección aun por debajo de 1 %.'],
] as const;
createRoot(document.getElementById('root')!).render(<div className="desk-app"><main className="stage"><div className="dscreen reports-screen"><h1>Variación vs período anterior</h1><p style={{ color: '#737984', margin: '6px 0 24px' }}>Flecha y texto siempre; el color solo refuerza.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap: 14 }}>{cases.map(([title, delta, note]) => <article className="report-kpi" key={title}><h2 className="geye" style={{ marginBottom: 12 }}>{title}</h2><ReportVariation delta={delta} /><p style={{ marginTop: 12 }}>{note}</p></article>)}</div></div></main></div>);
