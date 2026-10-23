import React, { Component, ErrorInfo, ReactNode } from 'react';
import { isNetworkErrorMessage, toUserMessage } from '../lib/user-message';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const errorMessage = toUserMessage(this.state.error, 'Ocurrió un error inesperado. Recargá la página y probá de nuevo.');

      if (isNetworkErrorMessage(errorMessage)) return null;
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-red-100">
            <h2 className="text-xl font-bold text-red-600 mb-2">Algo salió mal</h2>
            <p className="text-gray-600 text-sm mb-4">
              {errorMessage}
            </p>
            <button
              className="w-full bg-black text-white py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              onClick={() => window.location.reload()}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
