import type { ExpenseView } from '../services/expenses-api';
import type { ReturnCaseView } from '../services/returns-api';
import type { Client, Product, RepairOrder, Sale, TradeIn } from '../types';

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
