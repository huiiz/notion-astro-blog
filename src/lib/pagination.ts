export type PaginationState<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

export type PaginationKind = "home" | "posts";
export const HOME_PAGE_SIZE = 12;
export const POSTS_PAGE_SIZE = 12;

export function paginateItems<T>(items: T[], currentPage: number, pageSize: number): PaginationState<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    currentPage: safePage,
    totalPages,
    pageSize,
    totalItems,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    prevPage: safePage > 1 ? safePage - 1 : null,
    nextPage: safePage < totalPages ? safePage + 1 : null
  };
}

export function buildPageLink(page: number, kind: PaginationKind): string {
  if (kind === "home") {
    return page <= 1 ? `${import.meta.env.BASE_URL}` : `${import.meta.env.BASE_URL}page/${page}/`;
  }

  return page <= 1 ? `${import.meta.env.BASE_URL}posts/` : `${import.meta.env.BASE_URL}posts/page/${page}/`;
}

export function buildStaticPaginationPaths(totalItems: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_item, index) => ({
    params: { page: String(index + 2) }
  }));
}
