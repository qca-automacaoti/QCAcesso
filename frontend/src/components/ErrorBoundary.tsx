import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha inesperada na interface.', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <main className="centered-state"><h1>Não foi possível exibir esta página</h1><p>Ocorreu uma falha inesperada. Recarregue a aplicação para tentar novamente.</p><button className="button button-primary" onClick={() => window.location.reload()}>Recarregar</button></main>
  }
}
