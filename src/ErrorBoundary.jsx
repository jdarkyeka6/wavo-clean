import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep technical details in developer logs, never in the user-facing UI.
    console.error("[wavo] Unexpected app error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <h1>Sorry, something went wrong</h1>
            <p>Please try again.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
