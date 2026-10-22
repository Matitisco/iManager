import { useCallback, useEffect, useRef, useState } from 'react';
import { canOpenSection } from '../desk/sections';
import {
  archiveExpense as archiveExpenseApi,
  createExpense,
  fetchExpenses,
  restoreExpense as restoreExpenseApi,
  updateExpense,
  type ExpenseInput,
  type ExpenseView,
} from '../services/expenses-api';
import {
  archiveSupplier as archiveSupplierApi,
  createSupplier,
  fetchSuppliers,
  restoreSupplier as restoreSupplierApi,
  updateSupplier,
  type SupplierInput,
  type SupplierListItem,
} from '../services/suppliers-api';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';

export function useLedgerState(user: AuthUserLike | null, session: AppSession | null, status: BackendConnectionStatus) {
  const role = session?.membership?.role;
  const sections = session?.membership?.sections;
  const owner = role === 'OWNER';
  const canSuppliers = Boolean(session?.store) && canOpenSection('inventory', sections, role);
  const scope = `${user?.uid}:${session?.store?.id}:${role}:${JSON.stringify(sections)}`;
  const current = useRef(scope);
  current.current = scope;
  const [suppliers, setSuppliers] = useState<SupplierListItem[] | null>(canSuppliers ? null : []);
  const [expenses, setExpenses] = useState<ExpenseView[] | null>(owner ? null : []);
  const [expensesLoaded, setExpensesLoaded] = useState(!owner);
  const [supplierError, setSupplierError] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const ready = !!user && status === 'ready' && !!session?.store && !session.onboardingRequired;

  const reloadLedger = useCallback(async () => {
    if (!user || !ready) return;
    const ticket = scope;
    if (canSuppliers) {
      try {
        const rows = await fetchSuppliers(user);
        if (current.current === ticket) {
          setSuppliers(rows);
          setSupplierError('');
        }
      } catch (error) {
        if (current.current === ticket) {
          setSuppliers([]);
          setSupplierError(error instanceof Error ? error.message : 'No se pudieron cargar los proveedores');
        }
      }
    } else if (current.current === ticket) {
      setSuppliers([]);
    }
    if (owner) {
      try {
        const rows = await fetchExpenses(user);
        if (current.current === ticket) {
          setExpenses(rows);
          setExpensesLoaded(true);
          setExpenseError('');
        }
      } catch (error) {
        if (current.current === ticket) {
          setExpenses([]);
          setExpensesLoaded(true);
          setExpenseError(error instanceof Error ? error.message : 'No se pudieron cargar los gastos');
        }
      }
    } else if (current.current === ticket) {
      setExpenses([]);
      setExpensesLoaded(true);
    }
  }, [user, ready, scope, canSuppliers, owner]);

  useEffect(() => {
    setSuppliers(canSuppliers ? null : []);
    setExpenses(owner ? null : []);
    setExpensesLoaded(!owner);
    setSupplierError('');
    setExpenseError('');
    void reloadLedger();
  }, [reloadLedger, canSuppliers, owner]);

  const auth = () => {
    if (!user || !ready) throw new Error('El backend todavía no está listo. Volvé a intentar.');
    return user;
  };

  return {
    suppliers: ready ? suppliers : (canSuppliers ? null : []),
    supplierError,
    expenses: ready ? expenses : (owner ? null : []),
    expensesLoaded: ready ? expensesLoaded : !owner,
    expenseError,
    reloadLedger,
    saveSupplier: async (input: SupplierInput, id?: string) => {
      const saved = id ? await updateSupplier(auth(), id, input) : await createSupplier(auth(), input);
      await reloadLedger();
      return saved;
    },
    archiveSupplier: async (id: string, reason?: string) => {
      await archiveSupplierApi(auth(), id, reason);
      await reloadLedger();
    },
    restoreSupplier: async (id: string) => {
      const row = await restoreSupplierApi(auth(), id);
      await reloadLedger();
      return row;
    },
    saveExpense: async (input: ExpenseInput, id?: string) => {
      const saved = id ? await updateExpense(auth(), id, input) : await createExpense(auth(), input);
      await reloadLedger();
      return saved;
    },
    archiveExpense: async (id: string, reason?: string) => {
      await archiveExpenseApi(auth(), id, reason);
      await reloadLedger();
    },
    restoreExpense: async (id: string) => {
      const row = await restoreExpenseApi(auth(), id);
      await reloadLedger();
      return row;
    },
  };
}
