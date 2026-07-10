import React from 'react';
import { Button } from '@/components/ui/button';

interface State {
  hasError: boolean;
  error?: Error | null;
}

export class GlobalErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary] Uncaught error', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    // Full reload to clear any inconsistent runtime state
    try { window.location.reload(); } catch (_) {}
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-background text-foreground p-4">
          <div className="max-w-2xl w-full rounded-2xl bg-card border border-border p-6">
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">An unexpected error occurred while rendering this page.</p>
            <details className="mb-4 text-xs text-muted-foreground whitespace-pre-wrap">
              {this.state.error?.message}
              {'\n'}
              {this.state.error?.stack}
            </details>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={this.reset}>Reload</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default GlobalErrorBoundary;
