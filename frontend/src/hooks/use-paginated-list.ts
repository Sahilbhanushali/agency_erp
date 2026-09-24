import { api, ApiError, type Paginated } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

interface ListState<T> {
  /** The query this data answers, so loading is derived rather than tracked. */
  query: string | null;
  data: T[];
  total: number;
}

/**
 * Fetches one page of a list endpoint. `query` is a querystring rather than an
 * object so a caller can build it inline without the fetch re-firing every render.
 */
export function usePaginatedList<T>(
  path: string,
  query: string,
  errorMessage: string
) {
  const [state, setState] = useState<ListState<T>>({
    query: null,
    data: [],
    total: 0,
  });
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    // Guards against a slow early request landing after a newer one while typing.
    let cancelled = false;

    api
      .get<Paginated<T>>(`${path}?${query}`)
      .then((result) => {
        if (!cancelled) {
          setState({ query, data: result.data, total: result.meta.total });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof ApiError ? error.message : errorMessage);
        // Settle on this query anyway, so the table shows empty instead of a stuck spinner.
        setState({ query, data: [], total: 0 });
      });

    return () => {
      cancelled = true;
    };
  }, [path, query, errorMessage, reloadKey]);

  return {
    data: state.data,
    total: state.total,
    isLoading: state.query !== query,
    refetch,
  };
}
