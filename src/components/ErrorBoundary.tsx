import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { logError, generateCorrelationId } from "@/lib/errorLogger";
import { captureError } from "@/lib/errorMonitoring";
import { mapError } from "@/lib/errorMapping";
import { ErrorView } from "@/components/ui-premium/ErrorView";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional name for this boundary (for logging) */
  name?: string;
  /** Feature context for error tracking */
  feature?:
    | "auth"
    | "documents"
    | "weekly-reports"
    | "cronograma"
    | "formalizacoes"
    | "export-pdf"
    | "general";
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    const errorId = generateCorrelationId();
    return { hasError: true, error, errorId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { name = "Unknown", feature = "general" } = this.props;

    // Auto-clear corrupted query cache on root boundary catch
    if (name === "AppRoot" || !this.props.name) {
      try {
        const keys = Object.keys(window.localStorage);
        keys.forEach((key) => {
          if (key.startsWith("bwild-query-cache-")) {
            window.localStorage.removeItem(key);
          }
        });
        console.warn("[ErrorBoundary] Cleared query cache after crash");
      } catch {
        // Ignore storage errors
      }
    }

    // Log to structured logger
    logError("ErrorBoundary caught an error", error, {
      component: `ErrorBoundary[${name}]`,
      correlationId: this.state.errorId,
      componentStack: errorInfo.componentStack,
    });

    // Send to error monitoring
    captureError(error, {
      feature,
      action: "error_boundary_catch",
      route: window.location.pathname,
    });

    // In DEV, provide additional context
    if (import.meta.env.DEV) {
      console.group(`🔴 ErrorBoundary[${name}] caught an error`);
      console.error("Error:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Component Stack:", errorInfo.componentStack);
      console.error("Correlation ID:", this.state.errorId);
      console.groupEnd();
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const userError = this.state.error ? mapError(this.state.error) : null;
      const technicalDetails = this.state.error
        ? `${this.state.error.name}: ${this.state.error.message}\n\n${this.state.error.stack ?? ""}`
        : undefined;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6">
            <ErrorView
              kind={userError?.kind ?? "unknown"}
              title="Algo deu errado"
              description={
                userError?.userMessage ??
                "Ocorreu um erro inesperado. Tente novamente em instantes."
              }
              onRetry={this.handleRetry}
              correlationId={this.state.errorId}
              technicalDetails={technicalDetails}
              size="lg"
              bare
            />
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleGoHome} variant="outline">
                <Home className="h-4 w-4 mr-2" />
                Ir para início
              </Button>
              <Button onClick={this.handleReload} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight fallback component for smaller sections
 */
export function ErrorFallback({
  message = "Erro ao carregar este conteúdo",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="h-3 w-3 mr-1" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
