import { useCallback, useEffect, useState } from 'react';
import {
  resolveInvitationPreview,
  type InvitationPreview,
} from '../services/invitations-api';

export interface UseInvitationPreviewState {
  preview: InvitationPreview | null;
  invalid: boolean;
  error: string | null;
  isLoading: boolean;
  isRetrying: boolean;
  retryAttempt: number;
  reload: () => void;
}

function createEmptyState(): Omit<UseInvitationPreviewState, 'reload'> {
  return {
    preview: null,
    invalid: false,
    error: null,
    isLoading: false,
    isRetrying: false,
    retryAttempt: 0,
  };
}

export function useInvitationPreview(inviteToken?: string | null): UseInvitationPreviewState {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState(createEmptyState);

  useEffect(() => {
    if (!inviteToken) {
      setState(createEmptyState());
      return;
    }

    let cancelled = false;

    setState({
      preview: null,
      invalid: false,
      error: null,
      isLoading: true,
      isRetrying: false,
      retryAttempt: 0,
    });

    void resolveInvitationPreview(inviteToken, {
      onRetry: (attempt) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          isRetrying: true,
          retryAttempt: attempt,
        }));
      },
    }).then((result) => {
      if (cancelled) return;

      if (result.kind === 'valid') {
        setState({
          preview: result.preview,
          invalid: false,
          error: null,
          isLoading: false,
          isRetrying: false,
          retryAttempt: Math.max(result.attempts - 1, 0),
        });
        return;
      }

      if (result.kind === 'invalid') {
        setState({
          preview: null,
          invalid: true,
          error: null,
          isLoading: false,
          isRetrying: false,
          retryAttempt: 0,
        });
        return;
      }

      setState({
        preview: null,
        invalid: false,
        error: result.message,
        isLoading: false,
        isRetrying: false,
        retryAttempt: Math.max(result.attempts - 1, 0),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [inviteToken, refreshKey]);

  const reload = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return {
    ...state,
    reload,
  };
}
