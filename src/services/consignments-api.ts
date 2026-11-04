import type { Consignment, Sale } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export interface ConsignmentInput {
  clientId: string;
  items: { productId: string; amount: number; currency: 'ARS' | 'USD' }[];
}
export interface ConsignmentList {
  items: Consignment[];
  totals: {
    debt: { ARS: number; USD: number };
    equipment: number;
    people: number;
    oldestDays: number;
    oldestClient: string | null;
  };
}
export interface ConsignmentOptions {
  clients: { id: string; name: string; phone: string | null }[];
  products: {
    id: string;
    model: string;
    capacity: string;
    imei: string | null;
    price: number | null;
    currency: string | null;
    cantidad: number;
  }[];
}
export const fetchConsignments = (user: AuthUserLike) =>
  apiRequest<ConsignmentList>(user, '/api/consignments', {
    fallback: () => 'No se pudieron cargar las consignaciones',
    errorFrom: 'friendly',
  });
export const fetchConsignmentOptions = (user: AuthUserLike) =>
  apiRequest<ConsignmentOptions>(user, '/api/consignments/options', {
    fallback: () => 'No se pudieron cargar los clientes y equipos disponibles',
    errorFrom: 'friendly',
  });
export const createConsignments = (
  user: AuthUserLike,
  input: ConsignmentInput,
) =>
  apiRequest<{ items: Consignment[] }>(user, '/api/consignments', {
    method: 'POST',
    body: input,
    fallback: () => 'No se pudo guardar la consignación',
    errorFrom: 'friendly',
  });
export const payConsignment = (
  user: AuthUserLike,
  id: string,
  paymentMethod: string,
) =>
  apiRequest<{ consignment: Consignment; sale: Sale }>(
    user,
    `/api/consignments/${encodeURIComponent(id)}/pay`,
    {
      method: 'POST',
      body: { paymentMethod },
      fallback: () => 'No se pudo registrar el cobro',
      errorFrom: 'friendly',
    },
  );
