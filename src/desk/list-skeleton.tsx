import { Skeleton } from '../components/Skeleton';

export function listsAreLoading(loaded: boolean | undefined) {
  return loaded === false;
}

export function ListSkeleton({
  variant,
  rows = 4,
  testId,
}: {
  variant: 'rows' | 'cards' | 'lines';
  rows?: number;
  testId?: string;
}) {
  return (
    <div className={`list-skel ${variant}`} data-testid={testId} role="status" aria-label="Cargando" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        variant === 'lines' ? (
          <Skeleton key={index} className={`list-skel-bar ${index % 2 ? 'w70' : 'w40'}`} />
        ) : variant === 'cards' ? (
          <div key={index} className="list-skel-card" aria-hidden="true">
            <span className="list-skel-bar w40" />
            <span className="list-skel-bar w70" />
            <span className="list-skel-bar w50" />
          </div>
        ) : (
          <div key={index} className="list-skel-row" aria-hidden="true">
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
