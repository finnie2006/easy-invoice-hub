import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Changing this value clears the error, e.g. the current route. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Keeps a crash in one page from blanking the whole app (sidebar included). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Er ging iets mis</h1>
            <p className="text-sm text-muted-foreground">
              Deze pagina kon niet worden geladen. Probeer het opnieuw of ga terug naar een andere pagina.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" />
            Opnieuw laden
          </Button>
        </div>
      </div>
    );
  }
}
