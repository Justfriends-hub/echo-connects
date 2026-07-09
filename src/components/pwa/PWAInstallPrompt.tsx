import React from 'react';
import { X, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallPrompt() {
  const { showPrompt, isIOS, triggerInstall, dismiss } = usePWAInstall();

  if (!showPrompt) return null;

  return (
    <div className="pwa-install-backdrop" onClick={dismiss}>
      <div
        className="pwa-install-banner"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Install Chirp app"
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="pwa-install-close"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* App icon + branding */}
        <div className="pwa-install-header">
          <img
            src="/icon-192.png"
            alt="Chirp"
            className="pwa-install-icon"
          />
          <div className="pwa-install-text">
            <h3 className="pwa-install-title">Get the Chirp App</h3>
            <p className="pwa-install-subtitle">
              Install for faster access, offline support &amp; a native feel
            </p>
          </div>
        </div>

        {isIOS ? (
          /* ── iOS Safari: manual instructions ── */
          <div className="pwa-install-ios-steps">
            <div className="pwa-install-step">
              <span className="pwa-install-step-num">1</span>
              <span>
                Tap the <Share className="inline w-4 h-4 -mt-0.5 text-primary" /> <strong>Share</strong> button in Safari's toolbar
              </span>
            </div>
            <div className="pwa-install-step">
              <span className="pwa-install-step-num">2</span>
              <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
            </div>
            <div className="pwa-install-step">
              <span className="pwa-install-step-num">3</span>
              <span>Tap <strong>"Add"</strong> in the top right</span>
            </div>
          </div>
        ) : (
          /* ── Chrome/Android/Desktop: one-tap install ── */
          <div className="pwa-install-actions">
            <Button
              onClick={triggerInstall}
              className="pwa-install-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Install
            </Button>
            <button
              onClick={dismiss}
              className="pwa-install-later"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
