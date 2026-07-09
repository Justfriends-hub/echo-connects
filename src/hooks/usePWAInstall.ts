import { useEffect, useState, useCallback, useRef } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────
const LS_INSTALLED = 'chirp_pwa_installed';
const LS_DISMISS_COUNT = 'chirp_pwa_dismiss_count';
const LS_DISMISS_TIME = 'chirp_pwa_dismiss_time';
const LS_SESSION_COUNT = 'chirp_pwa_session_count';

/** Don't re-show until user has visited at least this many sessions after dismiss */
const MIN_SESSIONS_AFTER_DISMISS = 3;
/** Don't re-show until at least this many ms have passed since last dismiss */
const MIN_MS_AFTER_DISMISS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Helpers ────────────────────────────────────────────────────────────────

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked — silently ignore
  }
}

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Must be Safari (not Chrome/Firefox on iOS, which can't install PWAs either,
  // but Safari is the only one that supports Add to Home Screen)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS
  if ('standalone' in navigator && (navigator as any).standalone === true) return true;
  // Standard
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
}

function shouldShowAfterDismiss(): boolean {
  const dismissCount = parseInt(lsGet(LS_DISMISS_COUNT) || '0', 10);
  if (dismissCount === 0) return true; // Never dismissed

  const dismissTime = parseInt(lsGet(LS_DISMISS_TIME) || '0', 10);
  const sessionCount = parseInt(lsGet(LS_SESSION_COUNT) || '0', 10);
  const sessionAtDismiss = parseInt(lsGet('chirp_pwa_dismiss_session') || '0', 10);

  const sessionsSinceDismiss = sessionCount - sessionAtDismiss;
  const msSinceDismiss = Date.now() - dismissTime;

  return sessionsSinceDismiss >= MIN_SESSIONS_AFTER_DISMISS && msSinceDismiss >= MIN_MS_AFTER_DISMISS;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UsePWAInstallReturn {
  /** Whether to show the install prompt UI */
  showPrompt: boolean;
  /** Whether the user is on iOS Safari (needs manual instructions) */
  isIOS: boolean;
  /** Whether the app is running in standalone/installed mode */
  isStandalone: boolean;
  /** Trigger the native install prompt (Chrome/Android/Desktop only) */
  triggerInstall: () => Promise<void>;
  /** User dismissed the prompt — apply cooldown */
  dismiss: () => void;
}

export function usePWAInstall(): UsePWAInstallReturn {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS] = useState(() => isIOSSafari());
  const [isStandalone] = useState(() => isStandaloneMode());
  const deferredPromptRef = useRef<any>(null);

  // Increment session count on mount
  useEffect(() => {
    const current = parseInt(lsGet(LS_SESSION_COUNT) || '0', 10);
    lsSet(LS_SESSION_COUNT, String(current + 1));
  }, []);

  useEffect(() => {
    // Already installed — never show
    if (isStandalone || lsGet(LS_INSTALLED) === '1') return;

    // Check dismiss cooldown
    if (!shouldShowAfterDismiss()) return;

    // ── Chrome/Android/Desktop: capture beforeinstallprompt ──
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault(); // Prevent the mini-infobar
      deferredPromptRef.current = e;
      // Delay showing the custom prompt by 5 seconds
      setTimeout(() => {
        // Re-check — user might have installed in the meantime
        if (lsGet(LS_INSTALLED) !== '1') {
          setShowPrompt(true);
        }
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // ── iOS Safari: show after 5 seconds (no native event available) ──
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIOS) {
      iosTimer = setTimeout(() => setShowPrompt(true), 5000);
    }

    // ── Listen for successful install ──
    const handleInstalled = () => {
      lsSet(LS_INSTALLED, '1');
      setShowPrompt(false);
      deferredPromptRef.current = null;
    };
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [isStandalone, isIOS]);

  const triggerInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      lsSet(LS_INSTALLED, '1');
      setShowPrompt(false);
    }
    deferredPromptRef.current = null;
  }, []);

  const dismiss = useCallback(() => {
    setShowPrompt(false);
    const count = parseInt(lsGet(LS_DISMISS_COUNT) || '0', 10) + 1;
    lsSet(LS_DISMISS_COUNT, String(count));
    lsSet(LS_DISMISS_TIME, String(Date.now()));
    lsSet('chirp_pwa_dismiss_session', lsGet(LS_SESSION_COUNT) || '0');
  }, []);

  return { showPrompt, isIOS, isStandalone, triggerInstall, dismiss };
}
