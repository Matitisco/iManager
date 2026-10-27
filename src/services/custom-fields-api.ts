import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';
export type CustomFieldInput = { entity: 'inventory'; key: string; label: string; type: 'text' | 'date' | 'number'; order: number };
export type CustomFieldDefinition = CustomFieldInput & { id: string; archivedAt?: string | null };
export async function fetchCustomFieldDefinitions(user: AuthUserLike): Promise<CustomFieldDefinition[]> {
  const data = await apiRequest<{ definitions: CustomFieldDefinition[] }>(user, '/api/custom-field-definitions', { fallback: 'No se pudieron cargar los campos personalizados', errorFrom: 'friendly' });
  return data.definitions;
}
export async function createCustomFieldDefinition(user: AuthUserLike, input: CustomFieldInput) {
  const data = await apiRequest<{ definition: CustomFieldDefinition }>(user, '/api/custom-field-definitions', { method: 'POST', body: input, fallback: 'No se pudo crear el campo', errorFrom: 'friendly' });
  return data.definition;
}
export async function updateCustomFieldDefinition(user: AuthUserLike, id: string, input: { label?: string; order?: number }) {
  return apiRequest(user, `/api/custom-field-definitions/${id}`, { method: 'PATCH', body: input, fallback: 'No se pudo guardar el campo', errorFrom: 'friendly' });
}
export async function archiveCustomFieldDefinition(user: AuthUserLike, id: string) {
  return apiRequest(user, `/api/custom-field-definitions/${id}`, { method: 'DELETE', fallback: 'No se pudo archivar el campo', errorFrom: 'friendly' });
}
