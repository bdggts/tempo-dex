'use client';
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          background: 'var(--bg-card)', borderRadius: '20px',
          border: '1px solid var(--border-light)', margin: '16px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--danger)' }}>
            Something went wrong
          </h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.6 }}>
            This section encountered an error. Your wallet and funds are safe.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: 'var(--brand-primary)', color: 'white',
              border: 'none', borderRadius: '12px',
              padding: '10px 24px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          {this.props.showDetails && this.state.error && (
            <pre style={{
              marginTop: '16px', fontSize: '11px', color: 'var(--text-dim)',
              textAlign: 'left', overflow: 'auto', maxHeight: '100px',
              background: 'var(--bg-card)', padding: '8px', borderRadius: '8px',
            }}>
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
