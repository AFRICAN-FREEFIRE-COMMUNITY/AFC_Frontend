import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as adminApi from '@/lib/api/admin';
import type { PaginatedResponse, ApiResponse } from '@/lib/types/admin';

// Generic hook for API calls with loading and error states
export function useApiCall<T>(
  apiCall: () => Promise<{ data: T }>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall();
      setData(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Generic hook for paginated API calls
export function usePaginatedApi<T>(
  apiCall: (params: any) => Promise<{ data: PaginatedResponse<T> }>,
  initialParams: any = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState(initialParams);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall({ ...params, page: pagination.page, limit: pagination.limit });
      setData(response.data.data);
      setPagination(response.data.pagination);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [apiCall, params, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateParams = useCallback((newParams: any) => {
    setParams((prev: any) => ({ ...prev, ...newParams }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  const changePage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const changeLimit = useCallback((limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  return {
    data,
    pagination,
    loading,
    error,
    params,
    updateParams,
    changePage,
    changeLimit,
    refetch: fetchData,
  };
}

// Dashboard hooks
export function useDashboardStats() {
  return useApiCall(() => adminApi.dashboardApi.getStats());
}

export function useRecentActivity() {
  return useApiCall(() => adminApi.dashboardApi.getRecentActivity());
}

export function useDashboardAnalytics(period: string) {
  return useApiCall(() => adminApi.dashboardApi.getAnalytics(period), [period]);
}

// Events hooks
export function useEvents(filters: any = {}) {
  return usePaginatedApi(adminApi.eventsApi.getAll, filters);
}

export function useEvent(id: string) {
  return useApiCall(() => adminApi.eventsApi.getById(id), [id]);
}

export function useEventLeaderboard(id: string) {
  return useApiCall(() => adminApi.eventsApi.getLeaderboard(id), [id]);
}

// Teams hooks
export function useTeams(filters: any = {}) {
  return usePaginatedApi(adminApi.teamsApi.getAll, filters);
}

export function useTeam(id: string) {
  return useApiCall(() => adminApi.teamsApi.getById(id), [id]);
}

export function useTeamRoster(id: string) {
  return useApiCall(() => adminApi.teamsApi.getRoster(id), [id]);
}

// Players hooks
export function usePlayers(filters: any = {}) {
  return usePaginatedApi(adminApi.playersApi.getAll, filters);
}

export function usePlayer(id: string) {
  return useApiCall(() => adminApi.playersApi.getById(id), [id]);
}

export function usePlayerStats(id: string) {
  return useApiCall(() => adminApi.playersApi.getStats(id), [id]);
}

// News hooks
export function useNews(filters: any = {}) {
  return usePaginatedApi(adminApi.newsApi.getAll, filters);
}

export function useNewsArticle(id: string) {
  return useApiCall(() => adminApi.newsApi.getById(id), [id]);
}

// Leaderboards hooks
export function useLeaderboards(filters: any = {}) {
  return usePaginatedApi(adminApi.leaderboardsApi.getAll, filters);
}

export function useLeaderboard(id: string) {
  return useApiCall(() => adminApi.leaderboardsApi.getById(id), [id]);
}

export function useLeaderboardResults(id: string) {
  return useApiCall(() => adminApi.leaderboardsApi.getResults(id), [id]);
}

// Rankings hooks
export function useRankings(filters: any = {}) {
  return usePaginatedApi(adminApi.rankingsApi.getAll, filters);
}

export function useRanking(id: string) {
  return useApiCall(() => adminApi.rankingsApi.getById(id), [id]);
}

export function useRankingMetrics() {
  return useApiCall(() => adminApi.rankingsApi.getMetrics());
}

// Tiers hooks
export function useTiers(filters: any = {}) {
  return usePaginatedApi(adminApi.tiersApi.getAll, filters);
}

export function useTier(id: string) {
  return useApiCall(() => adminApi.tiersApi.getById(id), [id]);
}

export function useTierMetrics() {
  return useApiCall(() => adminApi.tiersApi.getMetrics());
}

// Shop hooks
export function useShopItems(filters: any = {}) {
  return usePaginatedApi(adminApi.shopApi.getAll, filters);
}

export function useShopItem(id: string) {
  return useApiCall(() => adminApi.shopApi.getById(id), [id]);
}

export function useShopOrders(filters: any = {}) {
  return usePaginatedApi(adminApi.shopApi.getOrders, filters);
}

// Infractions hooks
export function useInfractions(filters: any = {}) {
  return usePaginatedApi(adminApi.infractionsApi.getAll, filters);
}

export function useInfraction(id: string) {
  return useApiCall(() => adminApi.infractionsApi.getById(id), [id]);
}

// Drafts hooks
export function useDrafts(filters: any = {}) {
  return usePaginatedApi(adminApi.draftsApi.getAll, filters);
}

export function useDraft(id: string) {
  return useApiCall(() => adminApi.draftsApi.getById(id), [id]);
}

// History hooks
export function useAdminHistory(filters: any = {}) {
  return usePaginatedApi(adminApi.historyApi.getAll, filters);
}

export function useUserHistory(userId: string, filters: any = {}) {
  return usePaginatedApi((params) => adminApi.historyApi.getByUser(userId, params), filters);
}

// Match Results hooks
export function useMatchResults(filters: any = {}) {
  return usePaginatedApi(adminApi.matchResultsApi.getAll, filters);
}

export function useMatchResult(id: string) {
  return useApiCall(() => adminApi.matchResultsApi.getById(id), [id]);
}

// Partner hooks
export function useRosterVerification(filters: any = {}) {
  return useApiCall(() => adminApi.partnerApi.getRosterVerification(filters), [filters]);
}

export function usePartnerStats() {
  return useApiCall(() => adminApi.partnerApi.getPartnerStats());
}

// Mutation hooks for create/update/delete operations
export function useApiMutation<T, P = any>(
  apiCall: (params: P) => Promise<{ data: T }>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: any) => void;
    successMessage?: string;
  } = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (params: P) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall(params);
      
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
      
      if (options.onSuccess) {
        options.onSuccess(response.data);
      }
      
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
      
      if (options.onError) {
        options.onError(err);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall, options]);

  return { mutate, loading, error };
}

// Specific mutation hooks
export function useCreateEvent() {
  return useApiMutation(adminApi.eventsApi.create, {
    successMessage: 'Event created successfully',
  });
}

export function useUpdateEvent() {
  return useApiMutation(
    ({ id, data }: { id: string; data: any }) => adminApi.eventsApi.update(id, data),
    { successMessage: 'Event updated successfully' }
  );
}

export function useDeleteEvent() {
  return useApiMutation(adminApi.eventsApi.delete, {
    successMessage: 'Event deleted successfully',
  });
}

export function useCreateTeam() {
  return useApiMutation(adminApi.teamsApi.create, {
    successMessage: 'Team created successfully',
  });
}

export function useUpdateTeam() {
  return useApiMutation(
    ({ id, data }: { id: string; data: any }) => adminApi.teamsApi.update(id, data),
    { successMessage: 'Team updated successfully' }
  );
}

export function useDeleteTeam() {
  return useApiMutation(adminApi.teamsApi.delete, {
    successMessage: 'Team deleted successfully',
  });
}

export function useCreatePlayer() {
  return useApiMutation(adminApi.playersApi.create, {
    successMessage: 'Player created successfully',
  });
}

export function useUpdatePlayer() {
  return useApiMutation(
    ({ id, data }: { id: string; data: any }) => adminApi.playersApi.update(id, data),
    { successMessage: 'Player updated successfully' }
  );
}

export function useBanPlayer() {
  return useApiMutation(
    ({ id, reason }: { id: string; reason: string }) => adminApi.playersApi.ban(id, reason),
    { successMessage: 'Player banned successfully' }
  );
}

export function useUnbanPlayer() {
  return useApiMutation(adminApi.playersApi.unban, {
    successMessage: 'Player unbanned successfully',
  });
}

export function useCreateNews() {
  return useApiMutation(adminApi.newsApi.create, {
    successMessage: 'News article created successfully',
  });
}

export function useUpdateNews() {
  return useApiMutation(
    ({ id, data }: { id: string; data: any }) => adminApi.newsApi.update(id, data),
    { successMessage: 'News article updated successfully' }
  );
}

export function usePublishNews() {
  return useApiMutation(adminApi.newsApi.publish, {
    successMessage: 'News article published successfully',
  });
}

export function useUploadImage() {
  return useApiMutation(
    ({ file, type }: { file: File; type: string }) => adminApi.uploadApi.uploadImage(file, type),
    { successMessage: 'Image uploaded successfully' }
  );
}