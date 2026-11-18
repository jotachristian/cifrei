export interface EventCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export const EVENT_CATEGORIES: EventCategory[] = [
  { id: 'missas', label: 'Missas', icon: '', color: '#da5136e4' },
  { id: 'jovens', label: 'Grupos de jovens', icon: '', color: '' },
  { id: 'igreja', label: 'Eventos da igreja', icon: 'home-outline', color: '#8b5cf6' },
  { id: 'casamentos', label: 'Casamentos', icon: 'heart-outline', color: '#ec4899' },
  { id: 'artistas', label: 'Artistas específicos', icon: 'musical-notes-outline', color: '#f59e0b' },
];

export function getCategoryConfig(categoryId?: string): EventCategory | undefined {
  if (!categoryId) return undefined;
  return EVENT_CATEGORIES.find(c => c.id === categoryId);
}
