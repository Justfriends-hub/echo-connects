import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Users, TrendingUp, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface ChannelData {
  id: string;
  name: string;
  real_members: number;
  boosted_count: number;
  visible_total: number;
}

export function ChannelOverview({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [showReal, setShowReal] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setLoading(true);
    const { data: chats } = await supabase
      .from('chats')
      .select('id, name')
      .eq('type', 'channel');

    if (!chats) { setLoading(false); return; }

    const channelData: ChannelData[] = [];
    for (const chat of chats) {
      const { count: realMembers } = await supabase
        .from('chat_members')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id);

      const { data: boostData } = await supabase
        .rpc('get_visible_boost', { _chat_id: chat.id });

      channelData.push({
        id: chat.id,
        name: chat.name || 'Unnamed Channel',
        real_members: realMembers || 0,
        boosted_count: (boostData as number) || 0,
        visible_total: (realMembers || 0) + ((boostData as number) || 0),
      });
    }
    setChannels(channelData);
    setLoading(false);
  };

  // Demo data for when no channels exist
  const demoChannels: ChannelData[] = channels.length > 0 ? channels : [
    { id: 'd1', name: 'Tech News', real_members: 1247, boosted_count: 3276, visible_total: 4523 },
    { id: 'd2', name: 'Crypto Alerts', real_members: 892, boosted_count: 5108, visible_total: 6000 },
    { id: 'd3', name: 'Music Vibes', real_members: 340, boosted_count: 1660, visible_total: 2000 },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Megaphone className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold text-foreground">{demoChannels.length}</div>
            <div className="text-xs text-muted-foreground">Channels</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-online mx-auto mb-1" />
            <div className="text-2xl font-bold text-foreground">
              {demoChannels.reduce((a, c) => a + c.real_members, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Real Members</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold text-foreground">
              {demoChannels.reduce((a, c) => a + c.visible_total, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Visible Total</div>
          </CardContent>
        </Card>
      </div>

      {/* Toggle real vs boosted */}
      {isSuperAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowReal(!showReal)}
          className="border-border text-foreground"
        >
          {showReal ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
          {showReal ? 'Showing Real Counts' : 'Showing Public Counts'}
        </Button>
      )}

      {/* Channel List */}
      <div className="space-y-2">
        {demoChannels.map(channel => (
          <Card key={channel.id} className="bg-card border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-sm text-foreground">{channel.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {showReal ? (
                      <span>
                        <span className="text-online">{channel.real_members.toLocaleString()} real</span>
                        {' · '}
                        <span className="text-primary">+{channel.boosted_count.toLocaleString()} boosted</span>
                      </span>
                    ) : (
                      <span>{channel.visible_total.toLocaleString()} subscribers</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-foreground">
                  {showReal ? channel.real_members.toLocaleString() : channel.visible_total.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  {showReal ? 'actual' : 'public'}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
