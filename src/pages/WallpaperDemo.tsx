import React, {useState} from 'react';
import { Button } from '@/components/ui/button';

export default function WallpaperDemo() {
  const samples = [
    'https://images.unsplash.com/photo-1503264116251-35a269479413?w=1600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1600&q=80&auto=format&fit=crop',
    ''
  ];
  const [index, setIndex] = useState(0);
  const [showFrame, setShowFrame] = useState(true);

  const wallpaper = samples[index] || null;

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      {/* Fixed wallpaper */}
      <div aria-hidden style={{position:'fixed', inset:0, zIndex:0, pointerEvents:'none', backgroundImage: wallpaper ? `url(${wallpaper})` : undefined, backgroundSize: wallpaper ? 'cover' : undefined, backgroundPosition: wallpaper ? 'center' : undefined, backgroundRepeat: wallpaper ? 'no-repeat' : undefined}} className={!wallpaper ? 'chat-bg' : undefined} />

      {/* Controls */}
      <div style={{position:'relative', zIndex:30}} className="p-4">
        <div className="flex gap-2">
          <Button onClick={() => setIndex((i) => (i + 1) % samples.length)}>Next wallpaper</Button>
          <Button variant="outline" onClick={() => setShowFrame((s) => !s)}>{showFrame ? 'Hide frame' : 'Show frame'}</Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Tip: open an on-device keyboard to verify wallpaper stays fixed while the input moves.</p>
      </div>

      {/* Simulated chat frame (slides in/out) */}
      <div style={{position:'absolute', inset:0, zIndex:20, display:'flex', justifyContent:'center', alignItems:'center', pointerEvents:'auto'}}>
        <div style={{width:'92%', maxWidth:420, height:'80%', background:'rgba(17,24,39,0.9)', borderRadius:18, boxShadow:'0 8px 30px rgba(0,0,0,0.5)', transform: showFrame ? 'translateX(0)' : 'translateX(120%)', transition:'transform 300ms cubic-bezier(0.16,1,0.3,1)'}}>
          <div style={{padding:16, color:'white'}}>Simulated Chat Frame</div>
          <div style={{flex:1}} />
          <div style={{position:'absolute', left:0, right:0, bottom:0, padding:12}}>
            <input placeholder="Tap to open keyboard" style={{width:'100%', padding:12, borderRadius:999, border:'none', outline:'none'}} />
          </div>
        </div>
      </div>
    </div>
  );
}
