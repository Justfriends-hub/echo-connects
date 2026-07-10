import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ContactStatusGroup, Status } from '@/types/chat';

const STATUSES_QUERY_KEY = (userId: string) => ['statuses', userId];

function groupStatusesByUser(statuses: Status[], views: Record<string, boolean>, userId: string) {
  const groups = new Map<string, ContactStatusGroup>();

  statuses.forEach((status) => {
    const key = status.user_id;
    const existing = groups.get(key);
    const viewed = views[status.id] === true;

    if (!existing) {
      const group: ContactStatusGroup = {
        user: status.user || { id: status.user_id, username: '', display_name: 'Unknown', is_bot: false, hide_phone: false, is_online: false, last_seen: '', created_at: '', email: undefined, bio: undefined, avatar_url: undefined },
        statuses: [status],
        latestAt: status.created_at,
        totalCount: 1,
        viewedCount: viewed ? 1 : 0,
        allViewed: viewed,
      };
      groups.set(key, group);
      return;
    }

    existing.statuses.push(status);
    existing.totalCount += 1;
    existing.viewedCount += viewed ? 1 : 0;
    existing.allViewed = existing.viewedCount === existing.totalCount;
    if (new Date(status.created_at).getTime() > new Date(existing.latestAt).getTime()) {
      existing.latestAt = status.created_at;
      existing.user = status.user || existing.user;
    }
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    statuses: group.statuses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  }));
}

async function fetchStatuses(userId: string) {
  const now = new Date().toISOString();
  const [{ data: statuses, error: statusesError }, { data: views, error: viewsError }] = await Promise.all([
    supabase
      .from('statuses')
      .select('*')
      .gt('expires_at', now)
      .order('created_at', { ascending: false }),
    supabase
      .from('status_views')
      .select('status_id')
      .eq('viewer_id', userId),
  ]);

  if (statusesError || viewsError) {
    throw statusesError || viewsError;
  }

  const statusList = (statuses || []) as Status[];
  const userIds = Array.from(new Set(statusList.map((status) => status.user_id)));
  const { data: profiles, error: profilesError } = userIds.length > 0
    ? await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', userIds)
    : { data: [], error: null };

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = new Map<string, Status['user']>();
  (profiles || []).forEach((profile: any) => {
    profileMap.set(profile.id, {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      email: undefined,
      phone: undefined,
      bio: undefined,
      is_bot: false,
      hide_phone: false,
      is_online: false,
      last_seen: '',
      created_at: '',
    });
  });

  const statusMediaPaths = statusList
    .map((status) => status.media_path)
    .filter((path): path is string => typeof path === 'string' && path.trim() !== '');

  const signedUrlsMap = new Map<string, string>();
  if (statusMediaPaths.length > 0) {
    const uniqueMediaPaths = Array.from(new Set(statusMediaPaths));
    const { data: signedUrlResult, error: signedUrlsError } = await supabase
      .storage
      .from('status-media')
      .createSignedUrls(uniqueMediaPaths, 3600);

    if (signedUrlsError) {
      throw signedUrlsError;
    }

    const signedUrlsList = (signedUrlResult as any)?.signedUrls ?? signedUrlResult ?? [];
    (signedUrlsList || []).forEach((item: any) => {
      if (item?.path && item?.signedUrl) {
        signedUrlsMap.set(item.path, item.signedUrl);
      }
    });
  }

  const enrichedStatuses = statusList.map((status) => ({
    ...status,
    signed_url: status.media_path ? signedUrlsMap.get(status.media_path) : undefined,
    user: profileMap.get(status.user_id),
  }));

  const viewedMap: Record<string, boolean> = {};
  (views || []).forEach((view: any) => {
    viewedMap[view.status_id] = true;
  });

  const myStatuses = enrichedStatuses.filter((status) => status.user_id === userId);
  const otherStatuses = enrichedStatuses.filter((status) => status.user_id !== userId);

  const groups = groupStatusesByUser(otherStatuses, viewedMap, userId)
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());

  const recentUpdates = groups.filter((group) => !group.allViewed);
  const viewedUpdates = groups.filter((group) => group.allViewed);

  return {
    myStatuses,
    recentUpdates,
    viewedUpdates,
    hasUnseenStatuses: recentUpdates.length > 0,
  };
}

export function useStatuses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: STATUSES_QUERY_KEY(user?.id || ''),
    queryFn: async () => {
      if (!user) return { myStatuses: [], recentUpdates: [], viewedUpdates: [], hasUnseenStatuses: false };
      return fetchStatuses(user.id);
    },
    enabled: !!user,
    staleTime: 30000,
    retry: 2,
    refetchOnWindowFocus: false,
    placeholderData: {
      myStatuses: [],
      recentUpdates: [],
      viewedUpdates: [],
      hasUnseenStatuses: false,
    },
  });

  useEffect(() => {
    if (!user) return;
    const channelName = `statuses-list-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, () => queryClient.invalidateQueries({ queryKey: STATUSES_QUERY_KEY(user.id) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'status_views' }, () => queryClient.invalidateQueries({ queryKey: STATUSES_QUERY_KEY(user.id) }))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    ...query,
    myStatuses: query.data?.myStatuses || [],
    recentUpdates: query.data?.recentUpdates || [],
    viewedUpdates: query.data?.viewedUpdates || [],
    hasUnseenStatuses: query.data?.hasUnseenStatuses || false,
  };
}
