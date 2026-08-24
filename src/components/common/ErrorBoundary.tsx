import React from 'react';

interface State {
  hasError: boolean;
  error: string | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message || String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-base-0 text-text-primary flex flex-col items-center justify-center p-8 font-mono gap-4 select-none">
          <h2 className="text-commito-coral text-lg font-bold m-0 flex items-center gap-2">
            <span>⚠</span> Rendering Error
          </h2>
          <p className="text-text-secondary m-0 max-w-xl text-center text-xs break-words">
            {this.state.error}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-6 py-2 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md cursor-pointer text-xs font-semibold shadow-xs transition"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
