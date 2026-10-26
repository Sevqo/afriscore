import { useEffect, useRef, type RefObject } from 'react';
/** Contain keyboard focus and restore the trigger for modal navigation/overlays. */
export function useFocusScope<T extends HTMLElement>(
  active: boolean,
  close: () => void,
  ref: RefObject<T | null>,
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active || !ref.current) return;
    const prior = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
    (
      root.querySelector<HTMLElement>('[data-autofocus]') ||
      focusables()[0] ||
      root
    ).focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const els = focusables(),
          first = els[0],
          last = els.at(-1);
        if (!first) {
          e.preventDefault();
          root.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === root)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    root.addEventListener('keydown', key);
    return () => {
      root.removeEventListener('keydown', key);
      document.body.style.overflow = previousOverflow;
      prior?.focus();
    };
  }, [active, ref]);
}
