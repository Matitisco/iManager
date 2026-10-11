import type { Sale } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

type BackendSalesResponse = {
  sale?: Sale;
  sales?: Sale[];
};

export async function fetchBackendSales(user: AuthUserLike): Promise<Sale[]> {
  const data = await apiRequest<BackendSalesResponse>(user, '/api/sales', {
    fallback: (status) => `No se pudieron cargar las ventas (${status})`,
  });
  return data.sales ?? [];
}

export async function updateBackendSale(user: AuthUserLike, sale: Sale): Promise<Sale> {
  const data = await apiRequest<BackendSalesResponse>(user, `/api/sales/${sale.id}`, {
    method: 'PATCH',
    body: {
      clientId: sale.clientId,
      ...(sale.clientName !== undefined ? { clientName: sale.clientName } : {}),
      productId: sale.productId,
      ...(sale.deviceLabel !== undefined ? { deviceLabel: sale.deviceLabel } : {}),
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      date: sale.date,
      amount: sale.amount,
      categoryId: sale.categoryId ?? null,
      customFields: sale.customFields,
    },
    fallback: (status) => `No se pudo actualizar la venta (${status})`,
  });
  if (!data.sale) {
    throw new Error('Respuesta inválida al actualizar venta');
  }

  return data.sale;
}

export async function deleteBackendSale(user: AuthUserLike, saleId: string): Promise<void> {
  await apiRequest<void>(user, `/api/sales/${saleId}`, {
    method: 'DELETE',
    fallback: (status) => `No se pudo eliminar la venta (${status})`,
  });
}
