import React, { useState } from 'react';
import { ArrowLeft, Shield, Users, MessageSquare, TrendingUp, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { BoostControlPanel } from '@/components/admin/BoostControlPanel';
import { CommentApprovalQueue } from '@/components/admin/CommentApprovalQueue';
import { ChannelOverview } from '@/components/admin/ChannelOverview';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isSuperAdmin, isPlatformAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  // For demo purposes, allow access. In production, redirect non-admins.
  // if (!isSuperAdmin && !isPlatformAdmin) {
  //   navigate('/');
  //   return null;
  // }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Admin Dashboard</h1>
        <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
          {isSuperAdmin ? 'Super Admin' : isPlatformAdmin ? 'Platform Admin' : 'Demo Mode'}
        </span>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Tabs defaultValue="channels" className="space-y-4">
          <TabsList className="bg-card border border-border w-full grid grid-cols-3">
            <TabsTrigger value="channels" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Users className="w-4 h-4 mr-1.5" />
              Channels
            </TabsTrigger>
            <TabsTrigger value="boost" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <TrendingUp className="w-4 h-4 mr-1.5" />
              Boost
            </TabsTrigger>
            <TabsTrigger value="comments" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Comments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="channels">
            <ChannelOverview isSuperAdmin={isSuperAdmin} />
          </TabsContent>

          <TabsContent value="boost">
            <BoostControlPanel />
          </TabsContent>

          <TabsContent value="comments">
            <CommentApprovalQueue />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
