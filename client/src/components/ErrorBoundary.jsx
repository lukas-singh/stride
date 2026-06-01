import { Component } from 'react';
import { Link } from 'react-router-dom';

// Reusable error boundary. Catches render/lifecycle errors in its subtree so a
// crash in one page (e.g. Coach) can't take down the whole app.
//
// Props:
//   - fallback: optional. Either a React node, or a function
//     ({ error, reset }) => node. If omitted, a friendly default is shown.
//   - resetKey: when this value changes, the boundary clears its error state
//     (useful so generating a new plan re-renders instead of staying stuck).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught an error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback({ error: this.state.error, reset: this.reset });
      }
      if (fallback) return fallback;
      return <DefaultFallback reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ reset }) {
  return (
    <div className="card p-8 text-center flex flex-col items-center route-fade">
      <div className="text-5xl mb-3">😵‍💫</div>
      <h3 className="font-display font-bold text-lg text-txt">Something went wrong</h3>
      <p className="text-sm text-muted mt-1 max-w-[280px]">
        This section hit an unexpected error. Your data is safe — try again, or head back home.
      </p>
      <div className="flex gap-3 mt-5">
        <button onClick={reset} className="btn-primary max-w-[140px] px-5">Try again</button>
        <Link to="/" className="btn-ghost flex items-center">Go Home</Link>
      </div>
    </div>
  );
}
