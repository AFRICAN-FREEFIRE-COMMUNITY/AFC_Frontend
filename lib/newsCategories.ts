// newsCategoryKeys: every category a news post is in (inbox #160, owner 2026-10-05: "an article
// or post can be under several categories simultaneously").
//
// The backend (AFC-B afc_auth/views.py get_all_news, get_news_detail, get_pinned_news, and the
// create / edit answers) sends `categories`, a list in the order the admin picked them, and still
// `category`, the first of them, for older readers. A post from before posts could have several, or
// an answer from a backend that predates the field, has only `category`; this falls back to it, so
// no reader has to remember that.
//
// Read by: app/(user)/news/page.tsx (filter + card tags), app/(user)/_components/LatestNews.tsx,
// app/(user)/news/[slug]/_components/NewsClient.tsx, app/(a)/a/news/page.tsx (filter + card tags),
// app/(a)/a/news/[slug]/page.tsx and the admin edit form (app/(a)/a/news/[slug]/edit/page.tsx).
export function newsCategoryKeys(
  item: { categories?: unknown; category?: unknown } | null | undefined,
): string[] {
  if (!item) return [];
  if (Array.isArray(item.categories) && item.categories.length > 0) {
    return item.categories.filter((key): key is string => typeof key === "string");
  }
  return typeof item.category === "string" && item.category ? [item.category] : [];
}
