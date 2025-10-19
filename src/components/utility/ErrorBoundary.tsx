import React from "react";
import { AlertCircle } from "lucide-react";

type Props = {
  name?: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 border rounded-lg bg-destructive/10 text-destructive-foreground">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="space-y-2">
              <div className="font-semibold">Noget gik galt{this.props.name ? ` i ${this.props.name}` : ""}.</div>
              {this.state.message && (
                <div className="text-sm opacity-80">{this.state.message}</div>
              )}
              <button onClick={this.handleReset} className="inline-flex items-center px-3 py-1.5 rounded-md border bg-background hover:bg-muted transition">
                Prøv igen
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
