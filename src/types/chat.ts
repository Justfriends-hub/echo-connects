export type UserRole = 'super_admin' | 'platform_admin' | 'user';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  is_bot: boolean;
  hide_phone: boolean;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group' | 'channel';
  name?: string;
  avatar_url?: string;
  wallpaper_url?: string | null;
  description?: string;
  created_by: string;
  created_at: string;
  // UI-only fields
  last_message?: Message;
  unread_count?: number;
  member_count?: number;
  is_online?: boolean;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';
  reply_to_id?: string;
  status: 'sending' | 'sent' | 'delivered' | 'seen';
  created_at: string;
  updated_at?: string;
  sender?: UserProfile;
  reactions?: Reaction[];
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface ChannelSettings {
  id: string;
  chat_id: string;
  comments_enabled: boolean;
  allowed_reactions: string[];
  boost_count: number;
  boost_target?: number;
  boost_start_time?: string;
  boost_end_time?: string;
  boost_mode: 'instant' | 'gradual';
}

export interface Comment {
  id: string;
  message_id: string;
  user_id: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  user?: UserProfile;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

// ── Status Types ──
export type StatusMediaType = 'text' | 'image' | 'video';
export type StatusPrivacyType = 'contacts' | 'contacts_except' | 'only_share_with';

export interface Status {
  id: string;
  user_id: string;
  media_url?: string;
  media_path?: string;
  signed_url?: string;
  media_type: StatusMediaType;
  text_content?: string;
  background_color?: string;
  caption?: string;
  created_at: string;
  expires_at: string;
  privacy_mode: StatusPrivacyType;
  user?: UserProfile;
}

export interface StatusView {
  id: string;
  status_id: string;
  viewer_id: string;
  viewed_at: string;
  viewer?: UserProfile;
}

export interface ContactStatusGroup {
  user: UserProfile;
  statuses: Status[];
  latestAt: string;
  totalCount: number;
  viewedCount: number;
  allViewed: boolean;
}
