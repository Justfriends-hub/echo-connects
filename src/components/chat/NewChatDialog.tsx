import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserPlus, Users, X, Megaphone } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { UserProfile } from "@/types/chat";

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  onChatCreated?: (chatId: string) => void;
  mode?: "direct" | "group" | "channel";
}

export function NewChatDialog({
  open,
  onClose,
  onChatCreated,
  mode,
}: NewChatDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialogMode, setDialogMode] = useState<"direct" | "group" | "channel">(
    mode ?? "direct",
  );
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setDialogMode(mode ?? "direct");
      setSelectedUsers([]);
      setGroupName("");
      setChannelDescription("");
      return;
    }

    setDialogMode(mode ?? "direct");
    setLoading(true);
    const t = setTimeout(async () => {
      const term = search.trim().replace(/[%_,.()\"]/g, "");
      let query = supabase
        .from("profiles")
        .select("*")
        .neq("id", user?.id || "")
        .eq("is_bot", false)
        .limit(20);
      if (term) {
        query = query.or(
          `username.ilike.%${term}%,display_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`,
        );
      }
      const { data } = await query;
      setResults((data || []) as UserProfile[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, open, user, mode]);

  const startDirectChat = async (otherId: string) => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("get_or_create_direct_chat", {
      _other_user: otherId,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChatCreated?.(data as string);
  };

  const toggleUserSelection = (profile: UserProfile) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((u) => u.id === profile.id);
      if (exists) return prev.filter((u) => u.id !== profile.id);
      return [...prev, profile];
    });
  };

  const createChat = async (type: "group" | "channel") => {
    if (!groupName.trim()) {
      toast.error(
        type === "channel" ? "Enter a channel name" : "Enter a group name",
      );
      return;
    }
    if (type === "group" && selectedUsers.length < 1) {
      toast.error("Select at least 1 member");
      return;
    }

    setBusy(true);

    try {
      let chatId: string | null = null;
      let error: any = null;

      if (type === "group") {
        const memberIds = [user?.id, ...selectedUsers.map((u) => u.id)].filter(
          Boolean,
        ) as string[];
        const { data, error: rpcError } = await supabase.rpc(
          "create_group_chat",
          {
            _name: groupName.trim(),
            _member_ids: memberIds,
          },
        );
        chatId = data as string | null;
        error = rpcError;
      } else if (type === "channel") {
        const { data, error: rpcError } = await supabase.rpc("create_channel", {
          _name: groupName.trim(),
        });
        chatId = data as string | null;
        error = rpcError;

        if (chatId && channelDescription.trim()) {
          await supabase
            .from("chats")
            .update({ description: channelDescription.trim() })
            .eq("id", chatId);
        }
      }

      if (error) {
        toast.error(error.message || `Failed to create ${type}`);
        setBusy(false);
        return null;
      }

      if (!chatId) {
        toast.error(`Failed to create ${type}`);
        setBusy(false);
        return null;
      }

      setBusy(false);
      return chatId;
    } catch (err) {
      toast.error("Failed to create chat");
      setBusy(false);
      return null;
    }
  };

  const createGroup = async () => {
    const chatId = await createChat("group");
    if (chatId) onChatCreated?.(chatId);
  };

  const createChannel = async () => {
    const chatId = await createChat("channel");
    if (chatId) onChatCreated?.(chatId);
  };

  const initials = (n: string) =>
    n
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card/95 backdrop-blur-md border-border/60 max-w-md w-[calc(100%-32px)] sm:w-full p-5 rounded-2xl shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200 gap-4 overflow-hidden">
        {/* Dynamic Frame Header Block */}
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-foreground text-base font-bold tracking-tight flex items-center justify-between">
            <span>
              {dialogMode === "group"
                ? "New Group"
                : dialogMode === "channel"
                  ? "New Channel"
                  : "New Chat"}
            </span>
            {dialogMode !== "channel" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-semibold text-primary hover:bg-primary/10 px-2.5 h-8 rounded-full transition-all duration-200 active:scale-95"
                onClick={() =>
                  setDialogMode((prev) =>
                    prev === "group" ? "direct" : "group",
                  )
                }
              >
                <Users className="w-3.5 h-3.5 mr-1.5" />
                {dialogMode === "group" ? "Direct Chat" : "Create Group"}
              </Button>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/80 leading-relaxed pr-6">
            {dialogMode === "channel"
              ? "Create a broadcast space where only administrative ranks can post updates."
              : "Initialize direct individual conversation pipelines or structure a multi-user group panel."}
          </DialogDescription>
        </DialogHeader>

        {/* Form elements with smooth horizontal micro-padding spaces */}
        {dialogMode !== "direct" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <Input
              placeholder={
                dialogMode === "channel" ? "Channel name" : "Group name"
              }
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-muted/50 border-border/30 h-10 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-border/60 placeholder:text-muted-foreground/60 transition-all duration-200"
            />

            {dialogMode === "group" && selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto py-0.5 scrollbar-none">
                {selectedUsers.map((u) => (
                  <Badge
                    key={u.id}
                    variant="secondary"
                    className="gap-1 pr-1.5 pl-2.5 py-1 text-[11px] font-medium bg-muted/80 border border-border/30 rounded-full animate-in zoom-in-95 duration-150"
                  >
                    <span className="truncate max-w-[120px]">
                      {u.display_name}
                    </span>
                    <button
                      onClick={() => toggleUserSelection(u)}
                      className="ml-0.5 p-0.5 rounded-full hover:bg-background text-muted-foreground hover:text-destructive transition-colors duration-150"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Separator className="opacity-60" />
          </div>
        )}

        {dialogMode !== "channel" ? (
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            {/* Search Input Well Container */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <Input
                placeholder="Search by username, name or contacts"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9.5 bg-muted/50 border-border/30 h-10 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-border/60 placeholder:text-muted-foreground/60 transition-all duration-200"
              />
            </div>

            {/* Results Grid List Container */}
            <div className="overflow-y-auto max-h-[220px] sm:max-h-64 pr-1 -mr-2 scrollbar-none space-y-0.5">
              {loading ? (
                <div className="space-y-1 py-1">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 opacity-70"
                    >
                      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-28 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground/70 animate-in fade-in duration-200">
                  <UserPlus className="w-9 h-9 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-xs font-medium">No system users found</p>
                </div>
              ) : (
                results.map((p) => {
                  const isSelected = selectedUsers.some((u) => u.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() =>
                        dialogMode === "group"
                          ? toggleUserSelection(p)
                          : startDirectChat(p.id)
                      }
                      disabled={busy}
                      className="w-full flex items-center gap-3.5 px-3 py-2.5 hover:bg-muted/40 active:bg-muted/70 rounded-xl text-left transition-all duration-200 transform active:scale-[0.99] focus:outline-none"
                    >
                      {dialogMode === "group" && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleUserSelection(p)}
                          className="flex-shrink-0 border-border/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      )}
                      <Avatar className="w-10 h-10 border border-border/20 shadow-sm flex-shrink-0">
                        <AvatarImage
                          src={p.avatar_url}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                          {initials(p.display_name || "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate leading-tight">
                          {p.display_name}
                        </p>
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                          @{p.username}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Channel Description Field Frame Block Container */
          <div className="space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Textarea
              placeholder="Channel description (optional)"
              value={channelDescription}
              onChange={(e) => setChannelDescription(e.target.value)}
              className="bg-muted/50 border-border/30 resize-none text-sm min-h-[90px] rounded-xl focus-visible:ring-1 focus-visible:ring-border/60 placeholder:text-muted-foreground/60 leading-relaxed transition-all duration-200"
              rows={3}
            />
            <div className="flex items-start gap-3 bg-primary/5 border border-primary/10 px-3.5 py-3 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
              <p className="text-[11px] text-muted-foreground/90 leading-normal font-medium">
                Channels act as open broadcast panels. Anyone can create a
                channel, only the channel creator can post updates, and all
                channel members can react to each post.
              </p>
            </div>
          </div>
        )}

        {/* Unified Sticky Primary Action Form Triggers */}
        {dialogMode === "group" && selectedUsers.length > 0 && (
          <Button
            onClick={createGroup}
            disabled={busy}
            className="w-full gap-2 h-10 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transform active:scale-95 transition-transform animate-in slide-in-from-bottom-2 duration-200"
          >
            <Users className="w-4 h-4" />
            Create Group ({selectedUsers.length})
          </Button>
        )}
        {dialogMode === "channel" && (
          <Button
            onClick={createChannel}
            disabled={busy || !groupName.trim()}
            className="w-full gap-2 h-10 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transform active:scale-95 transition-transform"
          >
            <Megaphone className="w-4 h-4" />
            Create Channel
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
