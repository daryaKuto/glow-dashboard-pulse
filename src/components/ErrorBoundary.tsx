import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors and prevent full app crashes
 * Shows a user-friendly error message instead of the default React error screen
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    // Log to debug endpoint if available
    try {
      fetch('http://127.0.0.1:7242/ingest/833eaf25-0547-420d-a570-1d7cab6b5873', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'ErrorBoundary:componentDidCatch',
          message: 'React error boundary caught error',
          data: {
            errorMessage: error.message,
            errorStack: error.stack,
            componentStack: errorInfo.componentStack,
            errorName: error.name,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'error-boundary',
          hypothesisId: 'ERROR',
        }),
      }).catch(() => {});
    } catch (e) {
      // Ignore logging errors
    }

    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-brand-surface min-h-[400px] rounded-lg border border-red-200">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-heading font-bold text-brand-dark mb-2">
            Something went wrong
          </h2>
          <p className="text-brand-dark/70 font-body text-center mb-4 max-w-md">
            The canvas encountered an error. This might be a temporary issue.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-4 w-full max-w-2xl">
              <summary className="cursor-pointer text-sm text-brand-dark/60 mb-2">
                Error details (development only)
              </summary>
              <pre className="text-xs bg-red-50 p-4 rounded overflow-auto max-h-64">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack && (
                  <>
                    {'\n\nComponent Stack:'}
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}
          <Button
            onClick={this.handleReset}
            variant="outline"
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
