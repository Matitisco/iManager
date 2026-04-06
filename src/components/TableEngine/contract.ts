import type {
  TableBulkAction,
  TableColumnPreferenceState,
  TableControlledState,
  TableData,
  TableDataAdapter,
  TablePlugin,
  TableRemoteQuery,
  TableRowAction,
} from './types';

export interface TablePromptContractQuestion {
  id: string;
  prompt: string;
  required?: boolean;
}

export interface TablePromptContract<TData extends TableData> {
  summary: string;
  requiredQuestions: TablePromptContractQuestion[];
  adapters: Array<'local' | 'remote'>;
  supportsSelectionScope: boolean;
  supportsColumnPreferences: boolean;
  supportsPlugins: boolean;
  rowActions: Array<TableRowAction<TData>>;
  bulkActions: Array<TableBulkAction<TData>>;
}

export function buildTablePromptContract<TData extends TableData>(input: {
  adapter?: TableDataAdapter<TData>;
  state?: TableControlledState;
  plugins?: Array<TablePlugin<TData>>;
  query?: TableRemoteQuery;
  columnPreferences?: TableColumnPreferenceState;
}): TablePromptContract<TData> {
  const plugins = input.plugins ?? [];

  return {
    summary:
      'Reusable headless table engine with adapter-driven data access, configurable selection semantics, and plugin-based domain workflows.',
    requiredQuestions: [
      {
        id: 'data-mode',
        prompt:
          'La tabla trabaja con datos locales o con fetch remoto paginado/filtrado?',
        required: true,
      },
      {
        id: 'selection-scope',
        prompt:
          'La seleccion es solo sobre la pagina actual o tambien sobre todo el dataset filtrado?',
        required: true,
      },
      {
        id: 'column-prefs',
        prompt:
          'Donde se persisten orden, visibilidad, ancho y rename de columnas?',
        required: true,
      },
      {
        id: 'plugins',
        prompt:
          'Que workflows son de dominio y deben ir como plugin en vez de quedar en el core?',
        required: true,
      },
    ],
    adapters: input.adapter ? [input.adapter.mode] : ['local', 'remote'],
    supportsSelectionScope: Boolean(
      input.state?.selection?.allMatching || input.adapter?.mode === 'remote',
    ),
    supportsColumnPreferences: Boolean(
      input.columnPreferences ||
        (input.adapter?.mode === 'remote' && input.adapter.persistColumnPreferences),
    ),
    supportsPlugins: plugins.length > 0,
    rowActions: plugins.flatMap((plugin) => plugin.rowActions ?? []),
    bulkActions: plugins.flatMap((plugin) => plugin.bulkActions ?? []),
  };
}
