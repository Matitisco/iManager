import { createContext } from 'react';
import type { DeskTab, Overlay } from './types';

export type DeskUi = {
  tab: DeskTab;
  go: (tab: DeskTab) => void;
  open: (overlay: Overlay) => void;
  openRecord: (section: string, recordId: string, kind?: string) => void;
  close: () => void;
  toast: (message: string) => void;
  isStaff: boolean;
  canManageSensitive?: boolean;
  /** En celular, vuelve a Más cuando la sección no está en la barra. */
  back?: () => void;
};

export const DeskContext = createContext<DeskUi | null>(null);
