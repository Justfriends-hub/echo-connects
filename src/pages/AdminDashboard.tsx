import React, { useEffect, useState } from 'react';
import { ArrowLeft, Shield, Users, MessageSquare, TrendingUp, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelOverview } from '@/components/admin/ChannelOverview';
import { BoostControlPanel } from '@/components/admin/BoostControlPanel';
import { CommentApprovalQueue } from '@/components/admin/CommentApprovalQueue';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('channels');
  const [stats, setStats] = useState({ users: 0, channels: 0, pendingComments: 0, activeBoosts: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      loadStats();
    }
  }, [isAdmin, roleLoading]);

  const loadStats = async () => {
    setStatsLoading(true);
    const [usersResult, channelsResult, pendingResult, boostsResult] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('chats').select('id', { count: 'exact', head: true }).eq('type', 'channel'),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('channel_settings').select('chat_id', { count: 'exact', head: true }).gt('boost_target', 0),
    ]);

    setStats({
      users: usersResult.count ?? 0,
      channels: channelsResult.count ?? 0,
      pendingComments: pendingResult.count ?? 0,
      activeBoosts: boostsResult.count ?? 0,
    });
    setStatsLoading(false);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Skeleton className="h-10 w-72" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full border-border">
          <CardContent className="space-y-4 text-center">
            <Shield className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold text-foreground">Admin Access Required</h1>
            <p className="text-sm text-muted-foreground">
              You do not have permission to view the admin dashboard. Contact a super admin if you believe this is an error.
            </p>
            <Button className="mx-auto" onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabLabels: Record<string, string> = {
    channels: 'Channels',
    boost: 'Boost Control',
    comments: 'Comments',
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card sticky top-0 z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Shield className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">Signed in as {user?.user_metadata?.display_name || user?.email || 'Admin'}</p>
        </div>
      </div>

      <div className="px-4 py-2 bg-card/50 border-b border-border">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                <Home className="w-3.5 h-3.5" />
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink className="text-muted-foreground">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground font-medium">{tabLabels[activeTab]}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="px-4 pt-3">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="text-sm">Quick Actions</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[300px] gap-1 p-3">
                  <NavigationMenuLink asChild>
                    <button onClick={() => setActiveTab('channels')} className="block w-full text-left rounded-md p-3 hover:bg-accent transition-colors">
                      <div className="text-sm font-medium text-foreground">Channel Overview</div>
                      <p className="text-xs text-muted-foreground mt-0.5">View channels, members, and stats</p>
                    </button>
                  </NavigationMenuLink>
                  {isSuperAdmin && (
                    <NavigationMenuLink asChild>
                      <button onClick={() => setActiveTab('boost')} className="block w-full text-left rounded-md p-3 hover:bg-accent transition-colors">
                        <div className="text-sm font-medium text-foreground">Boost Control</div>
                        <p className="text-xs text-muted-foreground mt-0.5">Manage channel boost settings</p>
                      </button>
                    </NavigationMenuLink>
                  )}
                  <NavigationMenuLink asChild>
                    <button onClick={() => setActiveTab('comments')} className="block w-full text-left rounded-md p-3 hover:bg-accent transition-colors">
                      <div className="text-sm font-medium text-foreground">Comment Queue</div>
                      <p className="text-xs text-muted-foreground mt-0.5">Approve pending user comments</p>
                    </button>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <Separator className="mx-4 mt-2" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: 'Users', value: stats.users, loading: statsLoading },
              { label: 'Channels', value: stats.channels, loading: statsLoading },
              { label: 'Pending Comments', value: stats.pendingComments, loading: statsLoading },
              { label: 'Active Boosts', value: stats.activeBoosts, loading: statsLoading },
            ].map((stat) => (
              <Card key={stat.label} className="bg-card border-border">
                <CardContent className="p-4 text-center">
                  {stat.loading ? (
                    <Skeleton className="h-8 w-20 mx-auto" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground">{stat.value.toLocaleString()}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-card border border-border w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="channels" className="gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" /> Channels
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="boost" className="gap-1.5 text-xs">
                  <TrendingUp className="w-3.5 h-3.5" /> Boost
                </TabsTrigger>
              )}
              <TabsTrigger value="comments" className="gap-1.5 text-xs">
                <MessageSquare className="w-3.5 h-3.5" /> Comments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="channels">
              <ChannelOverview isSuperAdmin={isSuperAdmin} />
            </TabsContent>
            {isSuperAdmin && (
              <TabsContent value="boost">
                <BoostControlPanel />
              </TabsContent>
            )}
            <TabsContent value="comments">
              <CommentApprovalQueue />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
