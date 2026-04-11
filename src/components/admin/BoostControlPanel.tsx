import React, { useState, useEffect } from 'react';
import { TrendingUp, Zap, Clock, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BoostConfig {
  channelId: string;
  channelName: string;
  currentBoost: number;
  targetCount: number;
  mode: 'instant' | 'gradual';
  durationHours: number;
}

export function BoostControlPanel() {
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [boostMode, setBoostMode] = useState<'instant' | 'gradual'>('gradual');
  const [durationHours, setDurationHours] = useState('24');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    const { data } = await supabase
      .from('chats')
      .select('id, name')
      .eq('type', 'channel');
    setChannels(data || []);
  };

  const applyBoost = async () => {
    if (!selectedChannel || !targetCount) {
      toast.error('Select a channel and enter target count');
      return;
    }

    setApplying(true);
    const now = new Date();
    const endTime = new Date(now.getTime() + parseInt(durationHours) * 3600000);

    const { error } = await supabase
      .from('channel_settings')
      .upsert({
        chat_id: selectedChannel,
        boost_target: parseInt(targetCount),
        boost_mode: boostMode,
        boost_start_time: boostMode === 'gradual' ? now.toISOString() : null,
        boost_end_time: boostMode === 'gradual' ? endTime.toISOString() : null,
      }, { onConflict: 'chat_id' });

    setApplying(false);
    if (error) {
      toast.error('Failed to apply boost');
    } else {
      toast.success(`Boost applied: +${targetCount} subscribers ${boostMode === 'gradual' ? `over ${durationHours}h` : 'instantly'}`);
    }
  };

  // Demo channels if empty
  const displayChannels = channels.length > 0 ? channels : [
    { id: 'demo1', name: 'Tech News' },
    { id: 'demo2', name: 'Crypto Alerts' },
    { id: 'demo3', name: 'Music Vibes' },
  ];

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Subscriber Boost</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inflate visible subscriber counts. Boosted users are never detectable by normal users or channel admins. 
              Gradual mode uses a natural cubic ease-out curve for realistic growth.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Boost Form */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Configure Boost
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Channel</Label>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                {displayChannels.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Count */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Target Boost Count
            </Label>
            <Input
              type="number"
              placeholder="e.g. 5000"
              value={targetCount}
              onChange={e => setTargetCount(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          {/* Mode */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Boost Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBoostMode('gradual')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  boostMode === 'gradual'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-secondary text-muted-foreground'
                }`}
              >
                <Clock className="w-4 h-4 mb-1" />
                <div className="text-xs font-medium">Gradual</div>
                <div className="text-[10px] opacity-70">Natural growth curve</div>
              </button>
              <button
                onClick={() => setBoostMode('instant')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  boostMode === 'instant'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-secondary text-muted-foreground'
                }`}
              >
                <Zap className="w-4 h-4 mb-1" />
                <div className="text-xs font-medium">Instant</div>
                <div className="text-[10px] opacity-70">Immediate jump</div>
              </button>
            </div>
          </div>

          {/* Duration (gradual only) */}
          {boostMode === 'gradual' && (
            <div className="space-y-1.5 animate-fade-in">
              <Label className="text-xs text-muted-foreground">Duration (hours)</Label>
              <Input
                type="number"
                value={durationHours}
                onChange={e => setDurationHours(e.target.value)}
                className="bg-secondary border-border"
                min="1"
                max="720"
              />
              <p className="text-[10px] text-muted-foreground">
                ~{Math.round(parseInt(targetCount || '0') / Math.max(1, parseInt(durationHours || '1')))} subscribers/hour average
              </p>
            </div>
          )}

          <Button onClick={applyBoost} className="w-full" disabled={applying}>
            {applying ? 'Applying...' : `Apply ${boostMode === 'instant' ? 'Instant' : 'Gradual'} Boost`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
