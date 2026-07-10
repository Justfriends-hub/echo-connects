Implementation notes — Channel setup and mobile chat UX

This document explains how to set up channels (server-side) and how the chat input/keyboard behavior is implemented in the frontend. It also includes quick steps to test and tune mobile keyboard and emoji behaviour.

1) Supabase / Database setup

- Create a Supabase project and note these values for the frontend:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

- Run database migrations (recommended via `supabase` CLI or psql):

  supabase login
  supabase projects connect <project-ref>
  supabase db push

  Or, using psql / pgcli (point to your DB connection string), run the files in `supabase/migrations/` in chronological order.

- Important tables and functions (already included in migrations):
  - `chats` — unified table for `direct`, `group`, and `channel` types
  - `chat_members` — membership, roles (`owner|admin|member`)
  - `messages`, `reactions`, `comments`

- If you see `new row violates row-level security policy for table "chats"`, your Supabase RLS policies are blocking inserts.
  - The repo expects a policy like:
    `CREATE POLICY "Authenticated create chats" ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);`
  - This is the likely root cause if the app is authenticated but `POST /rest/v1/chats` still returns 403.
  - `channel_settings` — per-channel settings:
    - `comments_enabled` (BOOLEAN)
    - `allowed_reactions` (TEXT[])
    - boost-related fields: `boost_count`, `boost_target`, `boost_mode`, etc.
  - Helpful functions: `get_or_create_direct_chat`, `get_visible_boost`

- To enable comments for a channel via SQL:

  UPDATE channel_settings SET comments_enabled = true WHERE chat_id = '<channel-uuid>';

  To change allowed reactions:

  UPDATE channel_settings SET allowed_reactions = ARRAY['👍','❤️','🔥'] WHERE chat_id = '<channel-uuid>';

2) Frontend environment and running the app

- Create a `.env` in the project root with the two variables below (from Supabase project settings):

  VITE_SUPABASE_URL=https://xyz.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...

- Install and run dev server:

```powershell
npm install
npm run dev
```

- The app uses the Supabase client at `src/integrations/supabase` and expects Realtime and row-level security (RLS) configured by migrations.

3) How the chat bar and keyboard behavior is implemented

- The input bar is intentionally removed from normal flow and anchored with `position: fixed` using the `.chat-input-fixed` class. The fixed bottom value is controlled by a CSS variable `--vv-bottom`.

- `ChatInput.tsx` watches `window.visualViewport` and (for older environments) `window.resize` as a fallback. It updates `--vv-bottom` with the detected keyboard height so the input floats above the keyboard instead of pushing content.

- Parent scroll containers (e.g. `ChatArea.tsx`, `ChannelView.tsx`) receive the input bar height via the `onHeightChange` callback and apply bottom padding to the messages scroll area so the last message is never covered.

- Both `ChatArea` and `ChannelView` now listen for visual-viewport changes (and a fallback custom event `chat-visual-viewport`) and call `scrollIntoView()` on the bottom anchor to keep the message list anchored above the input bar when the keyboard appears.

4) Emoji behavior and mobile keyboards

- Tapping the emoji icon in the input will focus the textarea first (this brings up the device keyboard on mobile). After a short delay the emoji popover opens.

- New: native emoji preference toggle

  - A small toggle is available in the chat input (globe icon). When enabled the app will prefer the system/native emoji keyboard instead of opening the in-app emoji picker. This only focuses the input (so the keyboard appears) — users switch to the emoji keyboard via their device keyboard.

  - Preference is stored in `localStorage` under `prefersNativeEmoji`.

- Important limitation: browsers and mobile OSes do not provide a standardized API to programmatically switch the system keyboard to the emoji picker. The best we can do reliably is:
  - Focus the text input (keyboard opens).
  - Show the emoji popover UI inside the app (works everywhere).
  - On many mobile keyboards (e.g. Gboard, iOS keyboard) focusing the input makes the keyboard visible and the user can switch to the emoji view via the keyboard's emoji button.

- Practical guidance: on mobile, tap the emoji icon, then (if needed) tap the keyboard emoji button to switch to the native emoji keyboard. The in-app popover is also available for quick selection.

5) Testing and QA

- Test on iOS Safari and Android Chrome (or an emulator with a soft keyboard). Verify:
  - Tapping the input focuses and opens the keyboard.
  - The input slides above the keyboard (no body/content jump).
  - Messages remain visible and `scrollIntoView()` keeps the last message visible.
  - Tapping emoji focuses the input and opens the emoji grid; select to insert.

- If keyboard still pushes content on a particular webview or embedded environment, enable the fallback logging in the visualViewport handler to inspect `window.innerHeight` changes and tune the fallback heuristics.

6) Where to look in the code

- Chat input and keyboard handling: `src/components/chat/ChatInput.tsx`
- Messages scroll container and padding handling: `src/components/chat/ChatArea.tsx`
- Channel view (admin lock & chat input): `src/components/channel/ChannelView.tsx`
- DB migrations & channel schema: `supabase/migrations/*.sql`

7) Next steps / potential improvements

- Consider adding a small on-screen toggle to switch between native emoji keyboard and in-app emoji grid for mobile users.
- Improve heuristics for specific webviews (Cordova, Capacitor, in-app browsers) if the fallback resize detection misbehaves.
- Optionally add a tiny animation or fade for the message list when the keyboard appears to make the motion feel more native.

If you'd like, I can:
- Add an optional UI toggle to prefer native emoji keyboard vs in-app picker.
- Add telemetry/logging to detect which mobile clients still cause layout jumps.



# Status Feature, Navigation Split & Per-Section Error Isolation

Build a WhatsApp-style Status feature, wire a new Chats/Status tab switcher at the top of the sidebar, and make every app section fetch independently with per-section error boundaries and broken-connection indicators.

## Codebase Analysis — Current State

| Aspect | Current State |
|---|---|
| **Framework** | Vite + React 18 + TypeScript + Tailwind 3 + shadcn/ui |
| **Routing** | React Router DOM v6 — single `"/"` route renders `ChatLayout` |
| **Data fetching** | Custom hooks (`useChats`, `useMessages`, `useReadReceipts`, `useTypingPresence`) using raw `useState`/`useEffect` + Supabase client. **React Query is installed but unused for data fetching.** |
| **Realtime** | Supabase realtime channels — already per-feature (`chats-list`, `chat-{chatId}`, `receipts-{chatId}`, `typing:{chatId}`) |
| **Theme** | Dark-only. CSS variables in [index.css](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/index.css). Key tokens: `--background: 210 11% 15%`, `--primary/--accent: 200 80% 55%`, `--card: 210 11% 18%`, `--muted: 210 11% 25%`, `--online-green: 142 70% 49%`, `--unread-badge: 200 80% 55%` |
| **Supabase Storage** | **Not used yet** — no file upload code exists. A new storage bucket is required for status media. |
| **Database** | Tables: `profiles`, `user_roles`, `chats`, `chat_members`, `messages`, `reactions`, `channel_settings`, `comments`, `ad_watches`, `blocked_users`. **No status tables exist.** |
| **Two-box selector** | **Does not currently exist in code.** The sidebar ([ChatSidebar.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/chat/ChatSidebar.tsx)) has a hamburger menu + search bar at top, then collapsible sections (Channels, Groups, Direct Messages). **We need to create the tab switcher.** |
| **Bottom nav** | **Does not exist** — the screenshot shows WhatsApp's reference UI. The app uses a sidebar/panel layout. |
| **Error handling** | No error boundaries. `useChats`/`useMessages` catch errors and fall back to localStorage cache silently. No per-section error UI. |

> [!IMPORTANT]
> **No two-box selector currently exists in the codebase.** We will create a new tab switcher component inserted at the top of the sidebar area, between the header and the chat list. This is a new UI element, not a rewiring of an existing one.

---

## User Review Required

> [!WARNING]
> **Supabase Storage bucket**: Status media uploads require a Supabase Storage bucket named `status-media`. This needs to be created manually in the Supabase dashboard (Storage → New bucket → `status-media`, public). I'll add the SQL for the storage policy, but the bucket itself must exist. **Is this acceptable, or do you want me to handle it differently?**

> [!WARNING]
> **Scheduled cleanup for expired statuses**: The plan calls for a Supabase Edge Function (cron) to delete expired statuses. This requires `supabase functions deploy` and a cron trigger configured in the dashboard. Alternatively, I can implement client-side filtering (query only `WHERE expires_at > now()`) which works without any server-side cron setup. **Which approach do you prefer — Edge Function cron, or client-side-only filtering?**

> [!IMPORTANT]
> **React Query migration**: Part 3 requires each section to have independent query keys, retry configs, and error states. The codebase has `@tanstack/react-query` installed but unused. The plan migrates `useChats` and new hooks to React Query. The existing `useMessages`, `useReadReceipts`, and `useTypingPresence` hooks (which are scoped to a single open chat) will be wrapped with error handling but **not fully migrated to React Query** to avoid disrupting the well-tested message flow. **Is this approach acceptable?**

## Open Questions

> [!IMPORTANT]
> **Privacy mode complexity**: WhatsApp's "My contacts except..." and "Only share with..." modes require a `status_privacy_exclusions` table to store per-user exclusion/inclusion lists. This adds a contact-picker UI in the composer. Should I implement the full three-mode privacy system now, or start with a simpler single "My contacts" mode and add the exclusion lists in a follow-up?

---

## Proposed Changes

### Component 1 — Database Schema (Supabase)

New tables, enums, RLS policies, indexes, and storage configuration.

---

#### [NEW] [status_schema.sql](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/supabase/migrations/20260709_status_tables.sql)

```sql
-- New enum for status media type
CREATE TYPE public.status_media_type AS ENUM ('text', 'image', 'video');

-- New enum for status privacy mode  
CREATE TYPE public.status_privacy_type AS ENUM ('contacts', 'contacts_except', 'only_share_with');

-- Main statuses table
CREATE TABLE public.statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text,                          -- nullable for text-only
  media_type public.status_media_type NOT NULL DEFAULT 'text',
  text_content text,                       -- for text statuses or captions
  background_color text,                   -- hex color for text status backgrounds
  caption text,                            -- caption for media statuses
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  privacy_mode public.status_privacy_type NOT NULL DEFAULT 'contacts'
);

CREATE INDEX idx_statuses_user_expires ON public.statuses (user_id, expires_at DESC);
CREATE INDEX idx_statuses_expires ON public.statuses (expires_at);

-- Status views tracking
CREATE TABLE public.status_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, viewer_id)
);

CREATE INDEX idx_status_views_status ON public.status_views (status_id);
CREATE INDEX idx_status_views_viewer ON public.status_views (viewer_id);

-- Privacy exclusions (for "contacts_except" and "only_share_with" modes)
CREATE TABLE public.status_privacy_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_type public.status_privacy_type NOT NULL,
  UNIQUE (user_id, target_user_id, list_type)
);

-- RLS
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_privacy_list ENABLE ROW LEVEL SECURITY;

-- Statuses: users can see unexpired statuses from contacts (simplified — all authenticated for now)
CREATE POLICY "Users see active statuses" ON public.statuses
  FOR SELECT TO authenticated
  USING (expires_at > now());

CREATE POLICY "Users insert own statuses" ON public.statuses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own statuses" ON public.statuses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Status views: viewers can insert their own view, status owners can see views
CREATE POLICY "Users record own views" ON public.status_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users see views on own statuses" ON public.status_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid())
    OR auth.uid() = viewer_id
  );

-- Privacy list: users manage their own lists
CREATE POLICY "Users manage own privacy list" ON public.status_privacy_list
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Realtime
ALTER TABLE public.statuses REPLICA IDENTITY FULL;
ALTER TABLE public.status_views REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.status_views; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
```

**Key design decisions:**
- `expires_at` defaults to `now() + 24 hours` — the RLS policy filters on `expires_at > now()` so expired statuses are invisible without a cron job (client-side filtering as fallback)
- Privacy mode stored per-status but the exclusion list is per-user (matches WhatsApp — you set your privacy preference once, it applies to all future statuses)
- `status_views` has a unique constraint on `(status_id, viewer_id)` to prevent duplicate view records

---

#### [NEW] Supabase Storage bucket `status-media`

- Create bucket `status-media` in Supabase dashboard (public, 50MB file size limit)
- Storage policy: authenticated users can upload to `status-media/{user_id}/*`
- Storage policy: anyone authenticated can read from `status-media/*`

---

### Component 2 — TypeScript Types

---

#### [MODIFY] [chat.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/types/chat.ts)

Add new Status-related type definitions at the bottom of the file:

```typescript
// ── Status Types ──
export type StatusMediaType = 'text' | 'image' | 'video';
export type StatusPrivacyType = 'contacts' | 'contacts_except' | 'only_share_with';

export interface Status {
  id: string;
  user_id: string;
  media_url?: string;
  media_type: StatusMediaType;
  text_content?: string;
  background_color?: string;
  caption?: string;
  created_at: string;
  expires_at: string;
  privacy_mode: StatusPrivacyType;
  // UI enrichment
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
  latestAt: string;          // ISO timestamp of most recent status
  totalCount: number;        // total status updates from this user
  viewedCount: number;       // how many the current user has viewed
  allViewed: boolean;        // true if viewedCount === totalCount
}
```

---

### Component 3 — Data Hooks (React Query migration for new + existing)

---

#### [NEW] [useStatuses.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/hooks/useStatuses.ts)

A new hook using **React Query** for the Status list. This is the primary data hook for the Status tab.

**Responsibilities:**
- Fetch all active (unexpired) statuses from contacts
- Fetch the current user's own statuses
- Fetch view records for the current user to determine viewed/unviewed state
- Group statuses by user into `ContactStatusGroup` objects
- Separate into: `myStatus`, `recentUpdates` (unviewed), `viewedUpdates` (all viewed)
- Supabase realtime subscription on `statuses` table for new posts
- Supabase realtime subscription on `status_views` table for view count updates
- Pull-to-refresh via React Query's `refetch()`
- Independent query key: `['statuses', userId]`
- `staleTime: 30_000`, `retry: 2`

```typescript
// Query key pattern
const STATUSES_QUERY_KEY = (userId: string) => ['statuses', userId];

// Returns:
{
  myStatuses: Status[];           // current user's active statuses
  recentUpdates: ContactStatusGroup[];  // unviewed, sorted newest-first
  viewedUpdates: ContactStatusGroup[];  // all-viewed, sorted newest-first
  hasUnseenStatuses: boolean;     // for the unread indicator on the tab
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}
```

---

#### [NEW] [useStatusViewer.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/hooks/useStatusViewer.ts)

Manages the full-screen viewer state — progress timing, auto-advance, tap navigation, pause/resume.

**Responsibilities:**
- Accept a list of `ContactStatusGroup[]` (the playback queue)
- Track `currentGroupIndex` and `currentStatusIndex`
- Timer-based progress (5s for images/text, video duration for videos)
- Tap-right → next, tap-left → previous
- Hold → pause, release → resume
- Auto-advance to next contact when current finishes
- Record view by calling `supabase.from('status_views').upsert(...)` when a segment finishes or is navigated past
- Return `{ currentStatus, currentGroup, progress, isPaused, goNext, goPrev, pause, resume, close, seenByList }`

---

#### [NEW] [useStatusComposer.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/hooks/useStatusComposer.ts)

Handles status creation — media upload, text status creation.

**Responsibilities:**
- `postTextStatus(text, backgroundColor)` — insert into `statuses` table
- `postMediaStatus(file, caption, mediaType)` — upload to `status-media/{userId}/{timestamp}_{filename}`, get public URL, insert into `statuses`
- `deleteMyStatus(statusId)` — delete from `statuses` table
- Privacy mode read/write (stored in localStorage as default preference, applied per-status on post)
- Invalidate the `['statuses', userId]` React Query cache on successful post

---

#### [MODIFY] [useChats.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/hooks/useChats.ts)

**Wrap with React Query** so it has an independent query key and error state for Part 3:
- Query key: `['chats', userId]`
- Keep the existing Supabase realtime subscription logic (move into a `useEffect` alongside the query)
- Add `isError`, `error` to return value
- Keep localStorage caching as `initialData` / `placeholderData` for instant load
- `staleTime: 30_000`, `retry: 2`

---

### Component 4 — Tab Switcher (Part 1)

---

#### [NEW] [SidebarTabSwitcher.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/chat/SidebarTabSwitcher.tsx)

A two-tab pill/box selector inserted between the sidebar header and the content area.

**Design (matching existing theme):**
- Container: `bg-sidebar` with bottom border `border-sidebar-border`
- Two equal-width boxes side by side
- Active tab: `text-primary font-semibold` with a 2px bottom accent line (`bg-primary`)
- Inactive tab: `text-muted-foreground font-medium`
- Transition: smooth 200ms color + border transition
- Unread dot on Status tab: small `bg-unread-badge` circle (same as existing unread badge color), only shown when `hasUnseenStatuses` is true

```
┌──────────────────────────────────┐
│  Chats          Status  •        │
│  ━━━━━━                          │  ← accent underline on active tab
└──────────────────────────────────┘
```

---

#### [MODIFY] [ChatSidebar.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/chat/ChatSidebar.tsx)

- Add `activeTab` state (`'chats' | 'status'`) defaulting to `'chats'`
- Insert `<SidebarTabSwitcher>` after the header div (line 157) and before the ScrollArea (line 160)
- When `activeTab === 'chats'` → render existing chat list (no changes)
- When `activeTab === 'status'` → render new `<StatusListView>` component
- Pass `hasUnseenStatuses` from `useStatuses` to the tab switcher for the unread dot
- FAB button changes based on active tab:
  - Chats tab: existing Edit icon → new chat
  - Status tab: Camera icon → open status composer

---

### Component 5 — Status List Screen (Part 2)

---

#### [NEW] [StatusListView.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/StatusListView.tsx)

The main status list rendered when the Status tab is active. Uses `useStatuses` hook.

**Layout:**
1. **My Status row** (pinned top):
   - Avatar (`w-12 h-12`, same as chat list items)
   - If no active status: avatar with `+` badge in bottom-right (accent-colored circle with `+` icon)
   - If active status: avatar with accent ring, small `+` button beside it
   - Tap avatar → opens viewer for own statuses
   - Tap `+` → opens composer
   - Styling: `bg-sidebar-accent/50` background for subtle highlight

2. **"Recent updates"** section header: `text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-1.5` (matching existing section headers in ChatSidebar)
   - Each row: `<StatusContactRow>` with segmented unviewed ring (green/accent arcs)
   - Tap → opens viewer starting at this contact's statuses

3. **"Viewed updates"** section header: same styling
   - Each row: `<StatusContactRow>` with segmented muted ring (gray arcs)
   - `opacity-70` on the section for visual de-emphasis

4. Pull-to-refresh: `onTouchStart`/`onTouchMove`/`onTouchEnd` handlers that call `refetch()` with a pull-down indicator

---

#### [NEW] [StatusContactRow.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/StatusContactRow.tsx)

A single contact row in the status list.

- Avatar with segmented ring (SVG circle arcs)
- Contact name (`text-sm font-medium text-sidebar-foreground`)
- Relative time (`text-xs text-muted-foreground`) — "15m ago", "2h ago"
- Uses same row padding/sizing as `renderChatItem` in ChatSidebar (`px-3 py-2.5 gap-3`)

---

#### [NEW] [SegmentedStatusRing.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/SegmentedStatusRing.tsx)

SVG component that renders the WhatsApp-style segmented ring around an avatar.

**Props:** `totalSegments: number`, `viewedSegments: number`, `size: number`, `isOwn: boolean`

**Rendering:**
- Ring as SVG circle strokes with `stroke-dasharray` to create gaps between segments
- Unviewed segments: `stroke: hsl(var(--online-green))` (green, `142 70% 49%`)
- Viewed segments: `stroke: hsl(var(--muted))` (gray, `210 11% 25%`)
- Own status ring: `stroke: hsl(var(--primary))` (accent blue, `200 80% 55%`)
- Gap between segments: 4px arc gap (calculated from circumference / segments)
- If only 1 segment, render a full ring (no gap)

---

### Component 6 — Status Composer (Part 2)

---

#### [NEW] [StatusComposer.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/StatusComposer.tsx)

Full-screen overlay/modal for creating a status.

**Entry point menu** (shown first):
- Three option cards: 📷 Camera, 🖼️ Gallery, ✏️ Text
- Camera/Gallery → file picker → `MediaStatusComposer`
- Text → `TextStatusComposer`
- Uses existing `bg-card`, `border-border` styling

---

#### [NEW] [TextStatusComposer.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/TextStatusComposer.tsx)

Full-screen colored background with centered text input.

**Features:**
- Background color palette (6 preset colors — cycled by tapping a palette icon):
  - `#1B5E20` (deep green), `#0D47A1` (deep blue), `#4A148C` (deep purple),
  - `#BF360C` (deep orange), `#1A237E` (indigo), `#263238` (blue-gray)
  - These are dark-toned to match the app's dark aesthetic
- Centered `<textarea>` with white text, no visible border, large font (`text-2xl font-bold`)
- Font style toggle (Sans/Serif/Mono) — optional, simple `font-family` swap
- Top bar: back arrow (left), palette icon (right), send button (right)
- Send button: `bg-primary` circular button with Send icon
- On send: calls `useStatusComposer.postTextStatus(text, bgColor)`

---

#### [NEW] [MediaStatusComposer.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/MediaStatusComposer.tsx)

Full-screen media preview with caption.

**Features:**
- Full-screen black background with media preview (image: `object-contain`, video: `<video>` element)
- Caption text field overlaid near bottom: `bg-black/50 backdrop-blur` input
- Top bar: back arrow, send button
- On send: calls `useStatusComposer.postMediaStatus(file, caption, mediaType)`
- Loading state with progress indicator during upload

---

#### [NEW] [StatusPrivacySettings.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/StatusPrivacySettings.tsx)

Privacy mode selector accessible from the composer (gear/lock icon).

- Radio group: "My contacts", "My contacts except...", "Only share with..."
- For "except" and "only share with" modes: contact picker list with checkboxes
- Stores preference in localStorage (key: `chirp.statusPrivacy`) and writes to `status_privacy_list` table
- Uses existing `Dialog` component with `bg-card border-border` styling

---

### Component 7 — Status Viewer (Part 2)

---

#### [NEW] [StatusViewer.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/StatusViewer.tsx)

Full-screen status playback overlay. Uses `useStatusViewer` hook.

**Layout (top to bottom):**
1. **Progress bar row**: horizontal bar with segments
2. **Header**: avatar (small), name, timestamp, X button (top-right)
3. **Content area**: centered media/text (flex-1, fills available space)
4. **Bottom bar**: reply input (if viewing others) or "Seen by N" (if viewing own)

**Interactions:**
- Tap right half → `goNext()`
- Tap left half → `goPrev()`
- Long press → `pause()`, release → `resume()`
- Swipe down → `close()` (touch gesture detection)
- X button → `close()`

**Styling:**
- `position: fixed, inset: 0, z-index: 100, bg-black`
- Progress segments: `h-0.5 rounded-full` bars with gaps between
  - Active filling segment: `bg-white` with width animation
  - Completed: `bg-white`
  - Upcoming: `bg-white/30`
- Header text: `text-white text-sm font-medium`
- Smooth enter/exit animation: `animate-fade-in`

---

#### [NEW] [StatusProgressBar.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/StatusProgressBar.tsx)

The segmented progress bar at the top of the viewer.

**Props:** `totalSegments`, `currentIndex`, `progress` (0-1 float for active segment)

Renders a row of `<div>` bars:
- Completed (index < current): `bg-white w-full`
- Active (index === current): `bg-white` with `width: ${progress * 100}%`
- Upcoming (index > current): `bg-white/30 w-full`
- Gap: `gap-0.5` between segments

---

#### [NEW] [StatusReplyBar.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/StatusReplyBar.tsx)

Reply input shown when viewing someone else's status.

- Text input styled like the existing `ChatInput` but simplified: single-line input with send button
- On send: uses existing `get_or_create_direct_chat` RPC + message insert to send a reply as a DM
- Pauses the viewer timer while typing
- Styling: `bg-black/50 backdrop-blur-sm` container, white text input

---

#### [NEW] [StatusSeenBySheet.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/status/StatusSeenBySheet.tsx)

Bottom sheet showing who viewed your status.

- Triggered by tapping "Seen by N" at the bottom of the viewer when viewing own status
- Uses existing `Drawer` component from shadcn/ui
- Lists viewers with avatar, name, and timestamp
- Fetches from `status_views` joined with `profiles`
- Styling matches `ProfileDrawer`: `bg-card border-border`

---

### Component 8 — Per-Section Error Isolation (Part 3)

---

#### [NEW] [SectionErrorBoundary.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/SectionErrorBoundary.tsx)

A reusable React error boundary that wraps individual app sections.

**Features:**
- Catches thrown errors within child components
- Renders a compact fallback UI: broken-link icon + "Something went wrong" + "Tap to retry" button
- Does NOT crash or blank out sibling sections
- `onRetry` callback to reset the error boundary state and trigger re-fetch

**Fallback UI styling:**
- Container: `flex flex-col items-center justify-center py-8 gap-2`
- Icon: `Unplug` from lucide-react (disconnected plug), `w-6 h-6 text-muted-foreground`
- Text: `text-sm text-muted-foreground`
- Retry button: `text-xs text-primary hover:underline cursor-pointer`
- This is consistent across all sections — same icon, same layout

---

#### [NEW] [SectionErrorIndicator.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/SectionErrorIndicator.tsx)

A small inline broken-connection indicator shown near a section's header when a fetch or subscription fails.

**Props:** `isError: boolean`, `onRetry: () => void`, `label?: string`

**Rendering:**
- When `isError` is false: renders nothing
- When `isError` is true: renders a small row:
  - `Unplug` icon (12x12, `text-destructive`)
  - Optional label: "Connection lost"
  - Entire row is tappable → calls `onRetry()`
- Positioned inline near the section header (not a full-screen overlay)
- **Distinct from** the existing offline banner in [ChatLayout.tsx:207-211](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/chat/ChatLayout.tsx#L207-L211) which shows device network status

---

#### [MODIFY] [App.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/App.tsx)

- Configure the existing `QueryClient` with **default options** that DON'T share error state between queries:
  ```typescript
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
  ```

---

#### [MODIFY] [ChatSidebar.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/chat/ChatSidebar.tsx)

- Wrap the chat list content in `<SectionErrorBoundary>`
- Add `<SectionErrorIndicator>` near the "Direct Messages" / "Channels" section headers when `useChats` has `isError: true`
- The error indicator is tappable → calls `refetch()` from the `useChats` hook

---

#### [MODIFY] [ChatLayout.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/components/chat/ChatLayout.tsx)

- Wrap the chat area (lines 100-127) in `<SectionErrorBoundary>`
- Each major section gets its own boundary
- The offline banner (lines 207-211) remains unchanged — it's the device-level indicator
- Per-section indicators are additive, not a replacement

---

### Component 9 — CSS Additions

---

#### [MODIFY] [index.css](file:///c:/Users/ADMIN/OneDrive/Desktop/chattingapp1/echo-connects/src/index.css)

Add Status-specific utility classes and animations using only existing CSS variables:

```css
/* ── Status Feature ────────────────────────────────────── */
.status-viewer-enter {
  animation: fadeIn 0.2s ease-out;
}

.status-progress-fill {
  transition: width linear;
}

/* Segmented ring SVG strokes */
.status-ring-unviewed {
  stroke: hsl(var(--online-green));
}
.status-ring-viewed {
  stroke: hsl(var(--muted));
}
.status-ring-own {
  stroke: hsl(var(--primary));
}

/* Pull-to-refresh indicator */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.pull-refresh-spinner {
  animation: spin 0.8s linear infinite;
}
```

No new color tokens — all classes reference existing CSS variables.

---

## File Summary — All New & Modified Files

| Action | File | Component |
|--------|------|-----------|
| **NEW** | `supabase/migrations/20260709_status_tables.sql` | Database schema |
| **MODIFY** | `src/types/chat.ts` | Type definitions |
| **NEW** | `src/hooks/useStatuses.ts` | Status data hook (React Query) |
| **NEW** | `src/hooks/useStatusViewer.ts` | Viewer state management |
| **NEW** | `src/hooks/useStatusComposer.ts` | Status creation logic |
| **MODIFY** | `src/hooks/useChats.ts` | Add React Query wrapper + error state |
| **NEW** | `src/components/chat/SidebarTabSwitcher.tsx` | Chats/Status tab toggle |
| **MODIFY** | `src/components/chat/ChatSidebar.tsx` | Integrate tab switcher + Status view |
| **NEW** | `src/components/status/StatusListView.tsx` | Status list screen |
| **NEW** | `src/components/status/StatusContactRow.tsx` | Contact row in status list |
| **NEW** | `src/components/status/SegmentedStatusRing.tsx` | SVG segmented ring |
| **NEW** | `src/components/status/StatusComposer.tsx` | Composer entry point |
| **NEW** | `src/components/status/TextStatusComposer.tsx` | Text status creator |
| **NEW** | `src/components/status/MediaStatusComposer.tsx` | Media status creator |
| **NEW** | `src/components/status/StatusPrivacySettings.tsx` | Privacy mode picker |
| **NEW** | `src/components/status/StatusViewer.tsx` | Full-screen viewer |
| **NEW** | `src/components/status/StatusProgressBar.tsx` | Segmented progress bar |
| **NEW** | `src/components/status/StatusReplyBar.tsx` | Reply input in viewer |
| **NEW** | `src/components/status/StatusSeenBySheet.tsx` | "Seen by" list |
| **NEW** | `src/components/SectionErrorBoundary.tsx` | Error boundary wrapper |
| **NEW** | `src/components/SectionErrorIndicator.tsx` | Broken-connection indicator |
| **MODIFY** | `src/App.tsx` | QueryClient config |
| **MODIFY** | `src/components/chat/ChatLayout.tsx` | Error boundaries |
| **MODIFY** | `src/index.css` | Status CSS utilities |

**Total: 17 new files, 6 modified files**

---

## Verification Plan

### Automated Tests

```bash
npm run build          # Confirm no TypeScript errors
npm run test           # Confirm existing tests still pass
```

### Manual Verification

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Tap "Chats" tab | Shows existing chat list, no regressions |
| 2 | Tap "Status" tab | Shows Status list with "My Status" row |
| 3 | Status tab unread dot | Green dot appears when contacts have unseen statuses |
| 4 | Post text status | Full-screen composer → select bg color → type → send → appears in "My Status" |
| 5 | Post media status | Gallery pick → preview → add caption → send → appears in "My Status" |
| 6 | View contact status | Tap contact → full-screen viewer → progress bar fills → auto-advances |
| 7 | Segmented ring (unviewed) | Green segmented arcs, one per status update |
| 8 | Segmented ring (viewed) | Gray segmented arcs after viewing all |
| 9 | Tap right/left in viewer | Navigates between statuses |
| 10 | Long press in viewer | Pauses playback + progress bar |
| 11 | Reply to status | Text input → send → message appears in DM with that contact |
| 12 | "Seen by" on own status | Tap indicator → sheet shows viewers with timestamps |
| 13 | 24-hour expiry | Set a short expiry (e.g., 2 min) → confirm it disappears from the list |
| 14 | Section error isolation | Break one section's query → only that section shows broken-connection icon |
| 15 | Retry tappable | Tap broken-connection icon → only that section retries |
| 16 | Pull-to-refresh on Status | Pull down → spinner → statuses refresh |
