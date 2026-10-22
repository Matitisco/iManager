import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export interface ExpenseInput {
  date: string;
  category: string;
  amount: number;
  currency: 'ARS' | 'USD';
  exchangeRate?: number | null;
  notes?: string | null;
}

export interface ExpenseView {
  id: string;
  date: string;
  category: string;
  amount: number;
  currency: 'ARS' | 'USD';
  exchangeRate: number | null;
  notes: string | null;
  deletedAt: string | null;
}

export function fetchExpenses(user: AuthUserLike, archived = false) {
  const query = archived ? '?archived=1' : '';
  return apiRequest<{ expenses: ExpenseView[] }>(user, `/api/expenses${query}`, {
    fallback: 'No se pudieron cargar los gastos',
  }).then((data) => data.expenses);
}

export function createExpense(user: AuthUserLike, input: ExpenseInput) {
  return apiRequest<{ expense: ExpenseView }>(user, '/api/expenses', {
    method: 'POST',
    body: input,
    fallback: 'No se pudo guardar el gasto',
    errorFrom: 'friendly',
  }).then((data) => data.expense);
}

export function updateExpense(user: AuthUserLike, id: string, input: ExpenseInput) {
  return apiRequest<{ expense: ExpenseView }>(user, `/api/expenses/${id}`, {
    method: 'PATCH',
    body: input,
    fallback: 'No se pudo guardar el gasto',
    errorFrom: 'friendly',
  }).then((data) => data.expense);
}

export function archiveExpense(user: AuthUserLike, id: string, reason?: string) {
  return apiRequest<void>(user, `/api/expenses/${id}`, {
    method: 'DELETE',
    body: { reason },
    fallback: 'No se pudo archivar el gasto',
    errorFrom: 'friendly',
  });
}

export function restoreExpense(user: AuthUserLike, id: string) {
  return apiRequest<{ expense: ExpenseView }>(user, `/api/expenses/${id}/restore`, {
    method: 'POST',
    fallback: 'No se pudo restaurar el gasto',
    errorFrom: 'friendly',
  }).then((data) => data.expense);
}
