import type { User } from 'firebase/auth';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';
import type { ReportsOverview, ReportsOverviewParams } from '../types/reports';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

async function getAuthHeaders(user: User) {
  const token = await user.getIdToken();

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function getBaseUrlOrThrow() {
  const baseUrl = getBackendBaseUrl();

  if (!baseUrl) {
    throw new Error('Backend no configurado');
  }

  return trimTrailingSlash(baseUrl);
}

export async function fetchReportsOverview(
  user: User,
  params: ReportsOverviewParams
): Promise<ReportsOverview> {
  const baseUrl = getBaseUrlOrThrow();
  const query = new URLSearchParams();
  query.set('rangeKey', params.rangeKey);

  if (params.startDate) {
    query.set('startDate', params.startDate);
  }

  if (params.endDate) {
    query.set('endDate', params.endDate);
  }

  const response = await fetchWithTimeout(`${baseUrl}/api/reports/overview?${query.toString()}`, {
    headers: await getAuthHeaders(user),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudieron cargar los reportes (${response.status})`);
  }

  const data = (await response.json()) as { overview?: ReportsOverview };

  if (!data.overview) {
    throw new Error('Respuesta inválida al cargar reportes');
  }

  return data.overview;
}
