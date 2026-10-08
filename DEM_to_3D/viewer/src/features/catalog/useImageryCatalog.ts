import { useEffect, useState } from 'react';
import { preparedCatalogRepository, type ImageryCatalog } from './imageryCatalog';

export function useImageryCatalog() {
  const [catalog, setCatalog] = useState<ImageryCatalog | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setCatalog(null);
    setError(false);
    const timeout = setTimeout(() => controller.abort(), 10000);
    void preparedCatalogRepository
      .load(controller.signal)
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [retry]);
  return { catalog, error, retry: () => setRetry((value) => value + 1) };
}
