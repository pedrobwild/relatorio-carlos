export function isDebugAuthNavEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('debug_auth_nav') === '1';
  } catch {
    return false;
  }
}

export function debugAuthNav(event: string, payload?: unknown) {
  if (!isDebugAuthNavEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[debug_auth_nav]', event, payload ?? '');
}
