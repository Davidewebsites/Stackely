import { Navigate, useParams, useSearchParams } from 'react-router-dom';

type LegacySide = 'a' | 'b';

function normalizeDate(raw: string | null): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : new Date().toISOString().slice(0, 10);
}

export function LegacySharedStackRedirect() {
  const { stackId } = useParams<{ stackId: string }>();
  const [searchParams] = useSearchParams();
  const suffix = searchParams.toString();
  const target = `/view-stack/${stackId || ''}${suffix ? `?${suffix}` : ''}`;
  return <Navigate to={target} replace />;
}

export function LegacyDailyStackRedirect() {
  const { side } = useParams<{ side: string }>();
  const [searchParams] = useSearchParams();
  const date = normalizeDate(searchParams.get('date'));
  const normalizedSide: LegacySide = side?.toLowerCase() === 'b' ? 'b' : 'a';
  return <Navigate to={`/view-stack/${date}-${normalizedSide}`} replace />;
}
