export const NOTICE_SECTIONS = ['inventory', 'sales', 'tradeins', 'clients'] as const;
export type NoticeSection = (typeof NOTICE_SECTIONS)[number];

export type UnreadCounts = {
  total: number;
  bySection: Record<NoticeSection, number>;
};

export function unreadBySection(notes: Array<{ section: string; readAt?: string | null }>): UnreadCounts {
  const bySection: Record<NoticeSection, number> = { inventory: 0, sales: 0, tradeins: 0, clients: 0 };
  for (const note of notes) {
    if (note.readAt) continue;
    if (note.section === 'inventory' || note.section === 'sales' || note.section === 'tradeins' || note.section === 'clients') {
      bySection[note.section] += 1;
    }
  }
  return { total: NOTICE_SECTIONS.reduce((sum, section) => sum + bySection[section], 0), bySection };
}
