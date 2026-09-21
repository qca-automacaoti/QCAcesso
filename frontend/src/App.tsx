import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { AppRouter } from './features/auth/AuthRoutes'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  return <ErrorBoundary><BrowserRouter><AuthProvider><AppRouter /></AuthProvider></BrowserRouter></ErrorBoundary>
}
