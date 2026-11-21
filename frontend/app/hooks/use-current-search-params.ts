import { useOptimisticSearchParams } from "nuqs/adapters/react-router/v7";

/**
 * The current URL search params, kept in sync with nuqs state updates.
 *
 * nuqs (`useQueryState`) updates the URL with shallow `history.pushState` calls, which react-router does not see.
 * react-router's `useSearchParams` / `useLocation().search` therefore keep returning the params from the last router
 * navigation, so links built from them carry stale values (e.g. a previously selected `date`).
 * Use this hook instead whenever building links from the current query params.
 */
export function useCurrentSearchParams(): URLSearchParams {
	return useOptimisticSearchParams();
}
