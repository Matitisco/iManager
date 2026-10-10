import { ImanagerIcon } from './icons';

export function ModalCloseButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="modal-x" aria-label="Cerrar" disabled={disabled} onClick={onClick}>
      <ImanagerIcon name="cerrar" size={16} />
    </button>
  );
}
