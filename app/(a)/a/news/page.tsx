"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
// Live refresh (owner 2026-07-02): site-wide heartbeat; the news list re-fetches on each
// tick (and on tab return) so scheduled/new articles appear without a manual reload.
import { useLiveTick } from "@/hooks/useLiveTick";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { FullLoader } from "@/components/Loader";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
import { DeleteNewsModal } from "./_components/DeleteNewsModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  extractTiptapText,
  truncateText,
} from "@/components/text-editor/RenderDescription";
import {
  IconCalendar,
  // Homepage-pin marker on a news card (backlog item 22).
  IconPinned,
  IconCirclePlus,
  IconEye,
  IconPencil,
  IconShare,
  IconThumbDown,
  IconThumbUp,
} from "@tabler/icons-react";
import { DEFAULT_IMAGE, ITEMS_PER_PAGE } from "@/constants";
import { matchesSearch } from "@/lib/search";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
// Dates in the VIEWER's timezone and language (the backend is UTC). See components/LocalTime.tsx.
import { LocalTime } from "@/components/LocalTime";
import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const NewsAdminPage = () => {
  // Admin surfaces are in scope for i18n (owner override 2026-07-13). Namespace "adminNews", shared
  // with the create and edit forms.
  const t = useTranslations("adminNews");
  // The CATEGORY labels are read from the PUBLIC "news" namespace instead of being repeated here.
  // They name the same five categories the public news page names, off the same backend
  // News.CATEGORY_CHOICES keys, so a second copy would only be somewhere for the wording to drift.
  const tNews = useTranslations("news");
  const { token } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const [news, setNews] = useState<any>();

  // Admin list filter + the per-row category badge (getCategoryLabel below). Same keys and same
  // order as `newsCategories` in @/constants (the create/edit picker) and News.CATEGORY_CHOICES
  // on the backend; the labels come from the public news namespace, see tNews above.
  const categories = [
    { value: "all", label: tNews("categories.all") },
    { value: "general", label: tNews("categories.general") },
    { value: "tournament", label: tNews("categories.tournament") },
    { value: "education", label: tNews("categories.education") },
    { value: "bans", label: tNews("categories.bans") },
  ];

  const getCategoryLabel = (category: string) => {
    return categories.find((c) => c.value === category)?.label || category;
  };

  const getStatusBadgeVariant = (status: string = "") => {
    switch (status.toLowerCase()) {
      case "published":
        return "default";
      // "scheduled" = a future-dated post that the publish_scheduled_news task will auto-release.
      // Outline (gold border via className below) so it reads as "pending", distinct from live posts.
      case "scheduled":
        return "outline";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  const filteredNews = useMemo(() => {
    if (!news) return [];

    let filtered = news;

    // Filter by category
    if (filterCategory !== "all") {
      filtered = filtered.filter(
        (item: any) => item.category === filterCategory,
      );
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(
        (item: any) =>
          (item.status || "published").toLowerCase() ===
          filterStatus.toLowerCase(),
      );
    }

    // Filter by search query.
    // matchesSearch (shared @/lib/search) replaces the old per-field .toLowerCase().includes() chain:
    // it is punctuation/space/accent-insensitive and folds stylized "fancy font" unicode, so a query
    // like "ve" still finds titles/authors written as "V-E" or "Ｖ-Ｅ". One array haystack covers all
    // three fields (title, extracted Tiptap content text, author) in a single order-independent match.
    if (searchQuery.trim()) {
      filtered = filtered.filter((item: any) =>
        matchesSearch(
          [item.news_title, extractTiptapText(item.content), item.author],
          searchQuery,
        ),
      );
    }

    // Filter by date
    if (dateFilter) {
      const filterDateObj = new Date(dateFilter);
      filtered = filtered.filter((item: any) => {
        const itemDate = new Date(item.created_at);
        return itemDate.toDateString() === filterDateObj.toDateString();
      });
    }

    return filtered;
  }, [news, filterCategory, filterStatus, searchQuery, dateFilter]);

  const totalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE);
  const paginatedNews = filteredNews.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterStatus, dateFilter]);

  // Live refresh (owner 2026-07-02): background=true runs the same fetch OUTSIDE the
  // transition so `pending` stays false and the full-page FullLoader never flashes on
  // an automatic refresh. Manual calls (mount, delete onSuccess) keep the loader.
  const fetchNews = (background = false) => {
    const run = async () => {
      try {
        // get-all-news already folds the like/dislike COUNTS and the caller's own liked/disliked
        // state into this ONE response (it reads the viewer from the Bearer token). So we pass the
        // token and map the folded fields directly. Previously this page fired one
        // get-news-likes-dislikes-count POST PER article (a 1+N waterfall) that blocked the whole
        // admin news page on load - that loop is now gone.
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-news/`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        );

        const newsWithCounts = (res.data.news ?? []).map((item: any) => ({
          ...item,
          likes_count: item.likes ?? 0,
          dislikes_count: item.dislikes ?? 0,
          is_liked_by_user: item.is_liked_by_user ?? false,
          is_disliked_by_user: item.is_disliked_by_user ?? false,
        }));

        setNews(newsWithCounts);
      } catch (error: any) {
        toast.error(error?.response?.data.message);
      }
    };
    if (background) void run();
    else startTransition(run);
  };

  // Live refresh (owner 2026-07-02): tick 0 = the normal first load (with loader);
  // later ticks re-fetch in the background. Search/filter/pagination state lives
  // outside the fetch, so a background refresh never resets them.
  const tick = useLiveTick();
  useEffect(() => {
    fetchNews(tick > 0);
  }, [tick]);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("");
    setFilterCategory("all");
    setFilterStatus("all");
  };

  const handleCopyLink = async (slug: string) => {
    try {
      const url = `${env.NEXT_PUBLIC_URL}/news/${slug}`;
      await navigator.clipboard.writeText(url);
      toast.success(t("list.linkCopied"));
    } catch (error) {
      toast.error(t("list.copyFailed"));
    }
  };

  if (pending) return <FullLoader />;

  return (
    <div>
      <div className="flex flex-col md:flex-row items-start justify-start md:justify-between md:items-center mb-6">
        <PageHeader
          // Title is a ReactNode so the page-level ⓘ can sit right after it.
          title={
            <span className="inline-flex flex-wrap items-center">
              {t("list.title")}
              <InfoTip id="news._page" className="ml-1.5" />
            </span>
          }
        />
        {/* ⓘ sits beside the create action (sibling of the button). */}
        <div className="flex w-full items-center gap-1 md:w-auto">
          {/* data-tour="orgs-misc-news-create": admin-tour anchor (orgs-misc area).
              On the asChild Link so the attribute lands on the rendered anchor element. */}
          {/* flex-1, not w-full: `w-full` is 100% of the row REGARDLESS of the ⓘ sitting beside
              it, so on a phone the button filled the row and pushed the tip 9px past the right
              edge, scrolling the whole admin page sideways. flex-1 fills whatever is left after
              its sibling. Same trap as the sponsors page (2026-08-15), same fix. */}
          <Button className="flex-1 md:w-auto md:flex-none" asChild>
            <Link href="/a/news/create" data-tour="orgs-misc-news-create">
              <IconCirclePlus />
              {t("list.createNew")}
            </Link>
          </Button>
          <InfoTip id="news.create" />
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            {/* data-tour="orgs-misc-news-search": admin-tour anchor (orgs-misc area). */}
            <Input
              data-tour="orgs-misc-news-search"
              type="search"
              placeholder={t("list.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50 backdrop-blur-sm"
            />
          </div>
          <div className="flex-shrink-0">
            <div className="relative">
              <IconCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              {/* data-tour="orgs-misc-news-date-filter": admin-tour anchor (orgs-misc area). */}
              <Input
                data-tour="orgs-misc-news-date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 w-full md:w-auto bg-background/50 backdrop-blur-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              {/* data-tour="orgs-misc-news-category-filter": admin-tour anchor (orgs-misc area). */}
              <SelectTrigger
                data-tour="orgs-misc-news-category-filter"
                className="w-full md:w-[200px]"
              >
                <SelectValue placeholder={t("list.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              {/* data-tour="orgs-misc-news-status-filter": admin-tour anchor (orgs-misc area). */}
              <SelectTrigger
                data-tour="orgs-misc-news-status-filter"
                className="w-full md:w-[150px]"
              >
                <SelectValue placeholder={t("list.statusPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("list.status.all")}</SelectItem>
                <SelectItem value="published">{t("list.status.published")}</SelectItem>
                {/* Scheduled = not yet public; backend returns status "scheduled" for these. */}
                <SelectItem value="scheduled">{t("list.status.scheduled")}</SelectItem>
                <SelectItem value="draft">{t("list.status.draft")}</SelectItem>
                <SelectItem value="archived">{t("list.status.archived")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Active Filters */}
            {(searchQuery ||
              dateFilter ||
              filterCategory !== "all" ||
              filterStatus !== "all") && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Filters:</span>
                {searchQuery && (
                  <Badge variant="secondary" className="text-xs">
                    Search: "{searchQuery}"
                  </Badge>
                )}
                {dateFilter && (
                  <Badge variant="secondary" className="text-xs">
                    Date: {new Date(dateFilter).toLocaleDateString()}
                  </Badge>
                )}
                {filterCategory !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryLabel(filterCategory)}
                  </Badge>
                )}
                {filterStatus !== "all" && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {filterStatus}
                  </Badge>
                )}
                {/* data-tour="orgs-misc-news-clear-filters": admin-tour anchor (orgs-misc area). */}
                <Button
                  data-tour="orgs-misc-news-clear-filters"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}

            {/* Results count */}
            <div className="hidden md:block text-sm text-muted-foreground">
              {t("list.resultsCount", {
                shown: filteredNews.length,
                total: news?.length || 0,
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {filteredNews.length === 0 ? (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("list.empty.title")}</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ||
              dateFilter ||
              filterCategory !== "all" ||
              filterStatus !== "all"
                ? t("list.empty.filtered")
                : t("list.empty.none")}
            </p>
            {(searchQuery ||
              dateFilter ||
              filterCategory !== "all" ||
              filterStatus !== "all") && (
              <Button variant="outline" onClick={clearFilters}>
                {t("list.empty.clear")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* data-tour="orgs-misc-news-cards": admin-tour anchor (orgs-misc area). */}
          <div
            data-tour="orgs-misc-news-cards"
            className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2"
          >
            {paginatedNews.map((newsDetails: any) => (
              <Card
                key={newsDetails.news_id}
                className="overflow-hidden h-full bg-transparent gap-0 p-0 flex flex-col hover:shadow-lg transition-shadow"
              >
                <Link href={`/a/news/${newsDetails.slug}`} className="relative">
                  <Image
                    src={newsDetails.images_url || DEFAULT_IMAGE}
                    alt={newsDetails.news_title}
                    width={640}
                    height={360}
                    loading="lazy"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover aspect-video size-full"
                  />
                  <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-3">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {getCategoryLabel(newsDetails.category)}
                    </Badge>
                    <Badge
                      variant={getStatusBadgeVariant(
                        newsDetails.status || "published",
                      )}
                      className={`text-xs capitalize ${
                        newsDetails.status === "scheduled"
                          ? "border-amber-500/50 text-amber-600 dark:text-amber-400"
                          : ""
                      }`}
                    >
                      {/* The backend sends "published" / "scheduled" as a KEY, so the badge is
                          translated through the same list the status filter uses rather than
                          printing the raw value. t.has() guards it, because the backend's status
                          set can grow ahead of this catalogue and an unknown value must show
                          itself rather than crash the whole list. */}
                      {t.has(`list.status.${newsDetails.status || "published"}`)
                        ? t(`list.status.${newsDetails.status || "published"}`)
                        : newsDetails.status || t("list.status.published")}
                    </Badge>
                  </div>
                </Link>
                <CardContent className="flex-grow py-4 flex flex-col">
                  <Link
                    href={`/a/news/${newsDetails.slug}`}
                    className="text-base font-medium mb-2 line-clamp-2 hover:underline hover:text-primary"
                  >
                    {newsDetails.news_title}
                  </Link>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-3">
                    <Avatar className="h-5 w-5">
                      <AvatarImage
                        src={newsDetails.author?.avatar}
                        alt={newsDetails.author}
                      />
                      <AvatarFallback className="text-xs">
                        {newsDetails.author?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span>{newsDetails.author || t("list.card.unknownAuthor")}</span>
                    <span>•</span>
                    {/* The viewer's own timezone and language, never a hardcoded en-US
                        format: formatDate() writes English ordinals ("August 16th") and a
                        12-hour en-US clock whatever the admin's language is. */}
                    <LocalTime
                      value={newsDetails.published_at || newsDetails.created_at}
                      mode="date"
                    />
                  </div>
                  {/* Auto-release time for a not-yet-published (scheduled) article, in the
                      admin's own timezone and language; the Celery task flips it live then. */}
                  {newsDetails.status === "scheduled" &&
                    newsDetails.scheduled_publish_at && (
                      <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <IconCalendar size={14} />
                        <span>
                          {t("list.card.scheduledFor")}{" "}
                          <LocalTime
                            value={newsDetails.scheduled_publish_at}
                            mode="datetime"
                          />
                        </span>
                      </div>
                    )}
                  {/* Homepage pin (backlog item 22). `is_pinned` is the backend's derived answer
                      (pinned_until set, still in the future, and published), so this row can never
                      disagree with what /home actually shows. It is here rather than only on the
                      edit form so an editor can see at a glance how many notices are live - the
                      home block shows at most 3 at a time, newest first. */}
                  {newsDetails.is_pinned && newsDetails.pinned_until && (
                    <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-primary">
                      <IconPinned size={14} />
                      <span>
                        {t("list.card.pinnedUntil")}{" "}
                        <LocalTime value={newsDetails.pinned_until} mode="datetime" />
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3 break-words overflow-hidden flex-grow">
                    {truncateText(extractTiptapText(newsDetails.content), 150)}
                  </p>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md border border-green-500/20">
                      <IconThumbUp size={14} />
                      <span className="text-xs font-bold">
                        {newsDetails.likes_count || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-md border border-red-500/20">
                      <IconThumbDown size={14} />
                      <span className="text-xs font-bold">
                        {newsDetails.dislikes_count || 0}
                      </span>
                    </div>
                  </div>
                  <div className="mt-auto flex space-x-2">
                    <Button className="flex-auto" variant="outline" asChild>
                      <Link href={`/a/news/${newsDetails.slug}`}>
                        <IconEye />
                        {t("list.card.view")}
                      </Link>
                    </Button>
                    <Button className="flex-auto" variant="outline" asChild>
                      <Link href={`/a/news/${newsDetails.slug}/edit`}>
                        <IconPencil />
                        {t("list.card.edit")}
                      </Link>
                    </Button>

                    <DeleteNewsModal
                      isIcon={true}
                      newsId={newsDetails.news_id}
                      newsTitle={newsDetails.news_title}
                      onSuccess={fetchNews}
                    />

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="icon"
                            variant="secondary"
                            onClick={() => handleCopyLink(newsDetails.slug)}
                          >
                            <IconShare />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("list.card.copyLink")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="hidden md:block text-sm text-muted-foreground">
                {t("list.showing", {
                  from: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                  to: Math.min(
                    currentPage * ITEMS_PER_PAGE,
                    filteredNews.length,
                  ),
                  total: filteredNews.length,
                })}
              </p>
              <Pagination className="w-full md:w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1,
                    )
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            isActive={currentPage === page}
                            onClick={() => setCurrentPage(page)}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      </React.Fragment>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NewsAdminPage;
