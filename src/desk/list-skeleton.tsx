export function listsAreLoading(loaded: boolean | undefined) {
  return loaded === false;
}

export function ListSkeleton({
  variant,
  rows = 4,
  testId,
}: {
  variant: 'rows' | 'cards';
  rows?: number;
  testId: string;
}) {
  return (
    <div className={`list-skel ${variant}`} data-testid={testId} role="status" aria-label="Cargando">
      {Array.from({ length: rows }, (_, index) => (
        variant === 'cards' ? (
          <div key={index} className="list-skel-card">
            <span className="list-skel-bar w40" />
            <span className="list-skel-bar w70" />
            <span className="list-skel-bar w50" />
          </div>
        ) : (
          <div key={index} className="list-skel-row">
            <span className="list-skel-bar w60" />
            <span className="list-skel-bar w40" />
            <span className="list-skel-bar w30" />
            <span className="list-skel-bar w20" />
          </div>
        )
      ))}
    </div>
  );
}
