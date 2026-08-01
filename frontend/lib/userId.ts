const KEY = 'contexto:user_id';

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY);
}

export function setUserId(id: string): void {
  if (typeof window === 'undefined') return;
  if (!id) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, id);
}
