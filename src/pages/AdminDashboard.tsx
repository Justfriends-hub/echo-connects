import React from 'react';
import { ArrowLeft, Shield, Users, MessageSquare, TrendingUp, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle } from '@/components/ui/navigation-menu';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { ChannelOverview } from '@/components/admin/ChannelOverview';
import { BoostControlPanel } from '@/components/admin/BoostControlPanel';
import { CommentApprovalQueue } from '@/components/admin/CommentApprovalQueue';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const isSuperAdmin = role === 'super_admin';
  const [activeTab, setActiveTab] = React.useState('channels');

  const tabLabels: Record<string, string> = {
    channels: 'Channels',
    boost: 'Boost Control',
    comments: 'Comments',
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card sticky top-0 z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Admin Dashboard</h1>
      </div>

      {/* Breadcrumb */}
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

      {/* Navigation Menu */}
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
                      <p className="text-xs text-muted-foreground mt-0.5">View all channels, members, and stats</p>
                    </button>
                  </NavigationMenuLink>
                  {isSuperAdmin && (
                    <NavigationMenuLink asChild>
                      <button onClick={() => setActiveTab('boost')} className="block w-full text-left rounded-md p-3 hover:bg-accent transition-colors">
                        <div className="text-sm font-medium text-foreground">Boost Control</div>
                        <p className="text-xs text-muted-foreground mt-0.5">Manage subscriber count boosts</p>
                      </button>
                    </NavigationMenuLink>
                  )}
                  <NavigationMenuLink asChild>
                    <button onClick={() => setActiveTab('comments')} className="block w-full text-left rounded-md p-3 hover:bg-accent transition-colors">
                      <div className="text-sm font-medium text-foreground">Comment Queue</div>
                      <p className="text-xs text-muted-foreground mt-0.5">Approve or reject pending comments</p>
                    </button>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <Separator className="mx-4 mt-2" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
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
