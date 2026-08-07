import React from 'react';

interface State { hasError: boolean; error: string | null }

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
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#0d0d14', color: '#f0f0f3',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem', fontFamily: 'monospace', gap: '1rem'
        }}>
          <h2 style={{ color: '#FC6D26', margin: 0 }}>⚠ Rendering Error</h2>
          <p style={{ color: '#c8c8ce', margin: 0, maxWidth: 600, textAlign: 'center', fontSize: '0.85rem' }}>
            {this.state.error}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: '0.5rem 1.5rem', background: '#FC6D26', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
