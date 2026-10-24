import { useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoutePresentation, useNavigationState, useRouteViewport } from './route-viewport';
import { canonicalHash } from './hash-route';
import { usePagedRows } from './pager';

function List({ empty = false }: { empty?: boolean }) {
  const [query, setQuery] = useNavigationState('query', '');
  const page = usePagedRows(empty ? [] : Array.from({ length: 24 }, (_, i) => i), query, undefined, 'fixture');
  return <><input aria-label="Buscar" value={query} onChange={e => setQuery(e.target.value)} />
    <button onClick={() => page.setPage(2)}>Segunda página</button><output>{page.page}</output></>;
}
function Harness({ scope = 'store-a', tick = 0, empty = false }: { scope?: string; tick?: number; empty?: boolean }) {
  const viewport = useRouteViewport(scope);
  const [hash, setHash] = useState(location.hash);
  const [modal, setModal] = useState(false);
  useEffect(() => {
    const onHash = () => {
      const canonical = canonicalHash(location.hash);
      if (canonical) history.replaceState(history.state, '', canonical);
      viewport.syncRoute();
      setHash(location.hash);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [scope]);
  return <main ref={viewport.stageRef} data-testid="stage" data-tick={tick}>
    <RoutePresentation.Provider key={viewport.entry.id} value={viewport.entry.values}>
      {hash.includes('clientes') ? <List empty={empty} /> : <h1>{hash}</h1>}
      <button onClick={() => setModal(!modal)}>Detalle</button>{modal && <div role="dialog">Borrador</div>}
      <button onClick={() => viewport.backToMore(() => { location.hash = '#/mas'; })}>Volver</button>
    </RoutePresentation.Provider>
  </main>;
}
function navigate(hash: string, state: unknown = null) {
  act(() => { history.replaceState(state, '', hash); window.dispatchEvent(new HashChangeEvent('hashchange')); });
}
afterEach(() => { history.replaceState(null, '', '#/dashboard'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('scroll del contenedor por entrada', () => {
  it('canonicalizes old patterns entries once and preserves their history state and scroll', () => {
    history.replaceState({ external: 'keep' }, '', '#/returns?view=patterns&groupBy=model');
    render(<Harness />);
    expect(location.hash).toBe('#/analisis/fallas?groupBy=model');
    const stage = screen.getByTestId('stage');
    stage.scrollTop = 240;
    fireEvent.scroll(stage);
    const saved: unknown = history.state;
    const length = history.length;
    navigate('#/comercial/devoluciones?view=claims');
    expect(location.hash).toBe('#/comercial/devoluciones');
    expect(stage.scrollTop).toBe(0);
    navigate('#/returns?view=patterns&groupBy=model', saved);
    expect(location.hash).toBe('#/analisis/fallas?groupBy=model');
    expect(history.length).toBe(length);
    expect(history.state.external).toBe('keep');
    expect(stage.scrollTop).toBe(240);
  });

  it('abre un módulo al inicio y restaura la entrada de Más al volver', () => {
    history.replaceState({ external: 'keep' }, '', '#/mas');
    render(<Harness />);
    const stage = screen.getByTestId('stage');
    stage.scrollTop = 1172;
    fireEvent.scroll(stage);
    const moreState: unknown = history.state;
    expect(history.state.external).toBe('keep');
    navigate('#/rep');
    expect(location.hash).toBe('#/analisis/reportes');
    expect(stage.scrollTop).toBe(0);
    stage.scrollTop = 400;
    navigate('#/mas', moreState);
    expect(stage.scrollTop).toBe(1172);
  });

  it('conserva filtros/página en Atrás y no cambia scroll/foco al escribir o abrir un modal', () => {
    history.replaceState(null, '', '#/atencion/clientes');
    const view = render(<Harness />);
    const stage = screen.getByTestId('stage');
    const input = screen.getByRole('textbox');
    stage.scrollTop = 650;
    input.focus();
    fireEvent.change(input, { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('Segunda página'));
    fireEvent.click(screen.getByText('Detalle'));
    view.rerender(<Harness tick={1} />);
    expect(stage.scrollTop).toBe(650);
    expect(input).toHaveFocus();
    expect(screen.getByRole('dialog')).toHaveTextContent('Borrador');
    const listState: unknown = history.state;
    navigate('#/analisis/reportes');
    expect(stage.scrollTop).toBe(0);
    navigate('#/atencion/clientes', listState);
    expect(screen.getByRole('textbox')).toHaveValue('Ana');
    expect(screen.getByRole('status')).toHaveTextContent('2');
    expect(stage.scrollTop).toBe(650);
    navigate('#/analisis/reportes');
    navigate('#/atencion/clientes');
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('1');
    expect(stage.scrollTop).toBe(0);
  });

  it('conserva la página solicitada mientras una lista restaurada espera datos', () => {
    history.replaceState(null, '', '#/atencion/clientes');
    const view = render(<Harness />);
    fireEvent.click(screen.getByText('Segunda página'));
    const state: unknown = history.state;
    navigate('#/analisis/reportes');
    view.rerender(<Harness empty />);
    navigate('#/atencion/clientes', state);
    expect(screen.getByRole('status')).toHaveTextContent('1');
    view.rerender(<Harness />);
    expect(screen.getByRole('status')).toHaveTextContent('2');
  });

  it('respeta enlaces con query y aísla la memoria por tienda/usuario/permisos', () => {
    history.replaceState(null, '', '#/clientes?focus=123');
    const view = render(<Harness />);
    expect(location.hash).toBe('#/atencion/clientes?focus=123');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ana' } });
    const oldState: unknown = history.state;
    view.rerender(<Harness scope="store-b" />);
    expect(screen.getByRole('textbox')).toHaveValue('');
    navigate('#/analisis/reportes');
    navigate('#/atencion/clientes?focus=123', oldState);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('usa historial para Volver a Más y fallback en un enlace directo', () => {
    history.replaceState(null, '', '#/mas');
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    const view = render(<Harness />);
    navigate('#/analisis/reportes');
    fireEvent.click(screen.getByText('Volver'));
    expect(back).toHaveBeenCalledOnce();
    view.unmount();
    history.replaceState(null, '', '#/analisis/reportes');
    render(<Harness />);
    fireEvent.click(screen.getByText('Volver'));
    expect(location.hash).toBe('#/mas');
    expect(back).toHaveBeenCalledOnce();
  });
});

describe('restauración con contenido demorado', () => {
  it('espera altura suficiente y deja de intervenir al restaurar o al interactuar', () => {
    let resize: (() => void) | undefined;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback; }
      observe() {} disconnect() {}
    });
    history.replaceState(null, '', '#/mas');
    render(<Harness />);
    const stage = screen.getByTestId('stage');
    let top = 650;
    let maximum = 1000;
    Object.defineProperty(stage, 'scrollTop', { configurable: true, get: () => top, set: value => { top = Math.min(Number(value), maximum); } });
    const moreState: unknown = history.state;
    navigate('#/analisis/reportes');
    maximum = 150;
    navigate('#/mas', moreState);
    expect(top).toBe(150);
    maximum = 1000;
    act(() => resize?.());
    expect(top).toBe(650);
    top = 300;
    act(() => resize?.());
    expect(top).toBe(300);
    navigate('#/analisis/reportes');
    maximum = 100;
    navigate('#/mas', moreState);
    expect(top).toBe(100);
    fireEvent.wheel(stage);
    maximum = 1000;
    act(() => resize?.());
    expect(top).toBe(100);
    vi.unstubAllGlobals();
  });
});
