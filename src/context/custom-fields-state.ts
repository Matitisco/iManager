import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthUserLike } from '../types/auth-user';
import { fetchCustomFieldDefinitions, type CustomFieldDefinition } from '../services/custom-fields-api';
export function useCustomFieldsState(user: AuthUserLike | null, enabled: boolean, scope: string) {
  const [result, setResult] = useState<{ scope: string; definitions: CustomFieldDefinition[]; error: string | null }>({ scope: '', definitions: [], error: null });
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const reloadCustomFieldDefinitions = useCallback(async () => {
    if (!user || !enabled) return;
    try {
      const definitions = await fetchCustomFieldDefinitions(user);
      if (currentScope.current === scope) setResult({ scope, definitions, error: null });
    } catch (error) {
      if (currentScope.current === scope) setResult({ scope, definitions: [], error: error instanceof Error ? error.message : 'No se pudieron cargar los campos personalizados' });
      throw error;
    }
  }, [user, enabled, scope]);
  useEffect(() => { void reloadCustomFieldDefinitions().catch(() => undefined); }, [reloadCustomFieldDefinitions]);
  return { customFieldDefinitions: enabled && result.scope === scope ? result.definitions : [], customFieldDefinitionsError: enabled && result.scope === scope ? result.error : null, reloadCustomFieldDefinitions };
}
