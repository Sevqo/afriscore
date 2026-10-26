import { useRef, type ReactNode } from 'react';
import { useFocusScope } from './useFocusScope';
export function Overlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusScope(true, onClose, ref);
  return (
    <div
      className="modal-backdrop"
      ref={ref}
      tabIndex={-1}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
