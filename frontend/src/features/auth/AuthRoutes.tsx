import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth.context'
import { AppLayout } from '../../components/layout/AppLayout'
import { DashboardPage } from '../dashboard/DashboardPage'
import { UploadPage } from '../upload/UploadPage'
import { ChecklistPage } from '../checklist/ChecklistPage'
import { ControleAcessoPage } from '../controle-acesso/ControleAcessoPage'
import { AuditoriaPage } from '../auditoria/AuditoriaPage'
import { UsuariosPage } from '../administracao/UsuariosPage'
import { LoginPage } from './LoginPage'
import { ProtectedRoute } from './ProtectedRoute'

export function AppRouter() {
  const { state, login, reload } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return <main className="centered-state" role="status"><span className="spinner" aria-hidden="true" /><p>Verificando sua sessão…</p></main>
  }
  if (state.status === 'error') {
    return <main className="centered-state"><h1>Conexão indisponível</h1>
      <p role="alert">{state.message}</p>
      <button className="button button-primary" onClick={() => void reload()}>Tentar novamente</button>
    </main>
  }
  const signedIn = state.status === 'authenticated'
  // Após o login, volta para a página protegida que o usuário tentou abrir.
  const from = (location.state as { from?: string } | null)?.from
  const destino = from?.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/app'
  return (
    <Routes>
      <Route path="/login" element={signedIn
        ? <Navigate to={destino} replace />
        : <LoginPage onLogin={login} sessionMessage={state.message} />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="uploads" element={<UploadPage />} />
          <Route path="checklist" element={<ChecklistPage />} />
          <Route path="controle-acesso" element={<ControleAcessoPage />} />
          <Route path="auditoria" element={<AuditoriaPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={signedIn ? '/app' : '/login'} replace />} />
    </Routes>
  )
}
