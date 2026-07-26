import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
}

type AppErrorBoundaryProps = React.PropsWithChildren<object>;

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  declare props: Readonly<AppErrorBoundaryProps>;

  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Application render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">Something went wrong.</h1>
            <p className="mt-2 text-sm text-slate-600">
              The page encountered an unexpected error. Refresh the app and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
