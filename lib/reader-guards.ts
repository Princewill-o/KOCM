/** Keyboard deterrence only: browsers cannot observe every operating-system capture. */
export function isRestrictedReaderShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): boolean {
  const key = event.key.toLowerCase();
  return key === 'printscreen' || ((event.ctrlKey || event.metaKey) && ['p', 's', 'c'].includes(key)) || (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(key));
}
export const READER_IDLE_MS = 2 * 60 * 1000;
