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

