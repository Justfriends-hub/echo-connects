# Chirp — Fast & Secure Messaging

A real-time messaging app built with React, Vite, Supabase, and shadcn/ui.

## Features

- **Direct Messages** — 1-on-1 private chats with typing indicators and read receipts
- **Group Chats** — Create groups, add members, and chat together
- **Channels** — Broadcast channels with comments and reactions
- **Real-time** — Live messaging via Supabase Realtime (Presence + Postgres Changes)
- **Command Palette** — `Cmd+K` / `Ctrl+K` for quick navigation
- **Admin Dashboard** — Channel analytics, boost control, comment moderation
- **Rich UI** — Context menus, emoji picker, resizable panels, loading skeletons

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI | shadcn/ui, Tailwind CSS, Lucide Icons |
| Backend | Supabase (Auth, Database, Realtime) |
| State | TanStack React Query |
| Routing | React Router v6 |
| Charts | Recharts |
| Forms | React Hook Form + Zod validation |

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

The app runs on `http://localhost:8080`.

## Project Structure

```
src/
├── components/
│   ├── chat/          # Chat UI (ChatLayout, ChatArea, MessageBubble, etc.)
│   ├── channel/       # Channel-specific (ChannelView, Comments, Reactions)
│   ├── admin/         # Admin dashboard panels
│   └── ui/            # shadcn/ui components
├── contexts/          # Auth context
├── hooks/             # Custom hooks (useChats, useMessages, etc.)
├── integrations/      # Supabase client & types
├── pages/             # Route pages (Index, Auth, Settings, Admin)
├── types/             # TypeScript type definitions
└── lib/               # Utilities
```

## Environment Variables

Create a `.env` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

## License

Private — All rights reserved.
