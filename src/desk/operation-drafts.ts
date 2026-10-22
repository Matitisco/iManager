import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { OperationSource } from '../services/operations-api';
import { toUserMessage, isNetworkErrorMessage } from '../lib/user-message';
import { useOfflineRecovery } from '../lib/offline-recovery';

export const DRAFT_LOAD_ERROR_MESSAGE = 'No se pudieron cargar los borradores. Probá de nuevo en un momento.';

export function draftLoadNotice(error: unknown): string | null {
  if (isMissingDraftsRoute(error)) return null;
  return toUserMessage(error, DRAFT_LOAD_ERROR_MESSAGE);
}

export function useOperationDraftError(source: OperationSource): string | null {
  const { loadOperationDrafts } = useAppContext();
  const [draftError, setDraftError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useOfflineRecovery(draftError, () => setAttempt(value => value + 1));

  useEffect(() => {
    if (typeof loadOperationDrafts !== 'function') return;
    let active = true;
    setDraftError(null);
    loadOperationDrafts(source).catch((error: unknown) => {
      if (active) setDraftError(draftLoadNotice(error));
    });
    return () => { active = false; };
  }, [source, attempt]);

  return isNetworkErrorMessage(draftError) ? null : draftError;
}

function isMissingDraftsRoute(error: unknown): boolean {
  const status = readStatus(error);
  if (status === 404) return true;
  if (status != null) return false;
  const message = readMessage(error).trim().toLowerCase();
  if (!message) return false;
  if (message === 'not found') return true;
  if (/\broute\b/.test(message) && message.includes('not found')) return true;
  if (/\(404\)/.test(message)) return true;
  return false;
}

function readStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

function readMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return '';
}
