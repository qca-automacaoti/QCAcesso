import { NavLink } from 'react-router-dom'
import { FileSpreadsheet, History, KeyRound, LayoutDashboard, ListChecks, Settings, ShieldCheck, ShieldOff, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../features/auth/auth.context'
import type { PerfilUsuario } from '../../features/auth/auth.types'
import { Logo } from '../Logo'

const navItems: Array<{ label: string; to: string; icon: LucideIcon; perfis: PerfilUsuario[] }> = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard, perfis: ['ADMIN', 'SUPERVISOR', 'AUDITOR'] },
  { label: 'Uploads', to: '/app/uploads', icon: FileSpreadsheet, perfis: ['ADMIN', 'RH', 'SUPERVISOR'] },
  { label: 'Checklist', to: '/app/checklist', icon: ListChecks, perfis: ['ADMIN', 'RH', 'SUPERVISOR'] },
  { label: 'Controle de acesso', to: '/app/controle-acesso', icon: KeyRound, perfis: ['ADMIN', 'SUPERVISOR'] },
  { label: 'Confirmar bloqueios', to: '/app/controle-acesso/bloqueios', icon: ShieldOff, perfis: ['ADMIN', 'SUPERVISOR'] },
  { label: 'Confirmar desbloqueios', to: '/app/controle-acesso/desbloqueios', icon: ShieldCheck, perfis: ['ADMIN', 'SUPERVISOR'] },
  { label: 'Auditoria', to: '/app/auditoria', icon: History, perfis: ['ADMIN', 'SUPERVISOR', 'AUDITOR'] },
  { label: 'Usuários', to: '/app/usuarios', icon: Users, perfis: ['ADMIN', 'SUPERVISOR'] },
  { label: 'Configurações', to: '/app/configuracoes', icon: Settings, perfis: ['ADMIN', 'SUPERVISOR'] },
]

export function Sidebar() {
  const { state } = useAuth()
  const perfil = state.status === 'authenticated' ? state.usuario.perfil : undefined
  const itens = navItems.filter((item) => !perfil || item.perfis.includes(perfil))
  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <Logo href="/app" label="QCAcesso, dashboard" variant="light" />
      <div className="sidebar-section">
        <span className="sidebar-label">Menu</span>
        <nav>
          {itens.map(({ icon: Icon, ...item }) => (
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}>
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <footer className="sidebar-footer">
        <strong>QCAcesso</strong>
        Gestão de acessos · uso interno
      </footer>
    </aside>
  )
}
