import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageLoadError, PagePending } from '@/components/PageReliability';

export const getRouter = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: PageLoadError,
    defaultPendingComponent: PagePending,
  });

  return router;
};
