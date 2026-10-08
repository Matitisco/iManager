export function DeskToast({ message, show }: { message: string; show: boolean }) {
  return (
    <div className={`toast${show ? ' show' : ''}`} role={message ? 'status' : undefined}>
      <i />
      <span>{message}</span>
    </div>
  );
}
