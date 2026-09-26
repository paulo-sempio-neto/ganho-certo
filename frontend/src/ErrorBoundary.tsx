import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // React receives the details, but the fallback shown to users stays generic.
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-boundary" role="alert">
          <section>
            <p className="eyebrow">GanhoCerto</p>
            <h1>Algo saiu do lugar.</h1>
            <p>
              Nao foi possivel mostrar esta tela agora. Recarregue para tentar novamente.
            </p>
            <button className="button button-primary" type="button" onClick={this.handleReload}>
              Recarregar
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
