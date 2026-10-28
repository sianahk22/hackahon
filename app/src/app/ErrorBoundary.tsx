// Évite l'écran vide : en cas d'erreur d'affichage, on explique et on propose de recharger.
import { Component, type ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card bordered stack" role="alert" style={{ margin: 24, maxWidth: 640 }}>
        <h2>Cette page n’a pas pu s’afficher</h2>
        <p className="small muted">Erreur : {this.state.error.message}</p>
        <div className="row wrap">
          <button type="button" className="btn primary" onClick={() => location.reload()}>Recharger</button>
          <a className="btn" href="/">Revenir à l’accueil</a>
        </div>
      </div>
    );
  }
}
