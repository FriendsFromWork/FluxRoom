/** True on phones/tablets, where Enter should insert a newline and autofocus would pop the keyboard over the page. */
export function prefersTouchInput(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}
