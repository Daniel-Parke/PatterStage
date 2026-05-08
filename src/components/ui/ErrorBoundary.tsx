// ═══════════════════════════════════════════════════════════════
// ErrorBoundary — catches React child errors, renders fallback
// ═══════════════════════════════════════════════════════════════

"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label for the error, shown in the fallback */
  label?: string;
  /** Optional inline style (passes through to the wrapper) */
  className?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "An unexpected error occurred" };
  }

  handleReload = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={`flex items-center justify-center gap-3 p-6 rounded-xl border border-neon-red/30 bg-neon-red/5 ${this.props.className ?? ""}`}>
          <AlertTriangle className="w-5 h-5 text-neon-red flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-neon-red">
              {this.props.label ?? "Something went wrong"}
            </p>
            <p className="text-xs text-white/40 font-mono mt-0.5 truncate">
              {this.state.message}
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="ml-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
