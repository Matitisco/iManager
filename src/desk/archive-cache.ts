import type { ExpenseView } from '../services/expenses-api';
import type { ReturnCaseView } from '../services/returns-api';
import type { Client, Product, RepairOrder, Sale, TradeIn } from '../types';
import type { PermanentDeleteKind } from '../services/permanent-delete-api';

let revision = 0;
const listeners = new Set<() => void>();
export function archivedRevision() { return revision; }
export function subscribeArchivedRevision(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export function forgetArchivedRecord(kind: PermanentDeleteKind, id: string) {
  if (kind === 'eq') products = products.filter(row => row.id !== id);
  if (kind === 'cl') clients = clients.filter(row => row.id !== id);
  if (kind === 'sale') sales = sales.filter(row => row.id !== id);
  if (kind === 'cj') trades = trades.filter(row => row.id !== id);
  if (kind === 'ot') repairs = repairs.filter(row => row.id !== id);
  revision += 1;
  for (const listener of listeners) listener();
}

let products: Product[] = [];
let clients: Client[] = [];
let sales: Sale[] = [];
let trades: TradeIn[] = [];
let repairs: RepairOrder[] = [];

export function rememberArchivedProducts(rows: Product[]) { products = rows; }
export function rememberArchivedClients(rows: Client[]) { clients = rows; }
export function rememberVoidedSales(rows: Sale[]) { sales = rows; }
export function rememberVoidedTrades(rows: TradeIn[]) { trades = rows; }
export function rememberArchivedRepairs(rows: RepairOrder[]) { repairs = rows; }

export function archivedProduct(id: string) { return products.find((row) => row.id === id) ?? null; }
export function archivedClient(id: string) { return clients.find((row) => row.id === id) ?? null; }
export function voidedSale(id: string) { return sales.find((row) => row.id === id) ?? null; }
export function voidedTrade(id: string) { return trades.find((row) => row.id === id) ?? null; }
export function archivedRepair(id: string) { return repairs.find((row) => row.id === id) ?? null; }

let expenses: ExpenseView[] = [];
let returns: ReturnCaseView[] = [];
export function rememberArchivedExpenses(rows: ExpenseView[]) { expenses = rows; }
export function rememberArchivedReturns(rows: ReturnCaseView[]) { returns = rows; }
export function archivedExpense(id: string) { return expenses.find(row => row.id === id); }
export function archivedReturn(id: string) { return returns.find(row => row.id === id); }
