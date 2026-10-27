import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';

export function PasswordInput({ current = false }: { current?: boolean }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number | null; end: number | null } | null>(null);
  useLayoutEffect(() => {
    if (!input.current || !selection.current) return;
    input.current.focus();
    const { start, end } = selection.current;
    if (start !== null && end !== null) input.current.setSelectionRange(start, end);
  }, [visible]);
  function toggle() {
    selection.current = { start: input.current?.selectionStart ?? null, end: input.current?.selectionEnd ?? null };
    setVisible(value => !value);
  }
  return (
    <div className="password-control">
      <label htmlFor={id}>{current ? 'Password' : 'Password (at least 8 characters)'}</label>
      <div className="password-input-row">
        <input ref={input} id={id} required type={visible ? 'text' : 'password'} name="password"
          minLength={current ? 1 : 8} maxLength={200} autoComplete={current ? 'current-password' : 'new-password'} />
        <button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={id} aria-pressed={visible} onMouseDown={event => event.preventDefault()} onClick={toggle}>
          <Icon name={visible ? 'eye-off' : 'eye'} />
        </button>
      </div>
      {!current && <small>Use a unique passphrase. Spaces and password managers are welcome.</small>}
    </div>
  );
}
