import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  /** Short label shown in the error card, e.g. "Game Session" or "Dashboard" */
  feature: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Feature-level error boundary
 *
 * Renders an inline recovery card instead of crashing the entire app.
 * Wrap risky feature sections (game session, dashboard) with this component
 * so that a failure in one area does not take down the whole page.
 *
 * Usage:
 *   <FeatureErrorBoundary feature="Game Session">
 *     <LiveSessionCard ... />
 *   </FeatureErrorBoundary>
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error(`[FeatureErrorBoundary:${this.props.feature}]`, error, info);
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Card className="border-red-200">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <p className="text-sm font-medium text-red-900">
            {this.props.feature} failed to load
          </p>
          <p className="text-xs text-gray-600">
            An error occurred in this section. The rest of the app is unaffected.
          </p>

          {import.meta.env.DEV && this.state.error && (
            <pre className="w-full max-h-24 overflow-auto rounded bg-gray-100 p-2 text-left text-xs text-red-600">
              {this.state.error.message}
            </pre>
          )}

          <Button size="sm" variant="outline" onClick={this.handleRetry}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
}
