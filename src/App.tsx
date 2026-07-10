import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function DebugLogger() {
  React.useEffect(() => {
    const handleError = (event: Event) => {
      const target = event.target as HTMLLinkElement | HTMLScriptElement | HTMLImageElement | null;
      const source = target?.href || target?.src || '';
      if (source.includes('manifest.json')) {
        console.error('[Debug] Resource load error for manifest.json', { event, source });
      }
      if (source.includes('supabase.co/auth/v1/signup')) {
        console.error('[Debug] Resource load error for signup endpoint', { event, source });
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[Debug] Unhandled promise rejection', event.reason);
    };

    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <DebugLogger />
        <PWAInstallPrompt />
        <GlobalErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Login />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </GlobalErrorBoundary>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
