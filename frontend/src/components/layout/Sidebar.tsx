import { NavLink } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard', to: '/app' },
  { label: 'Uploads', to: '/app/uploads' },
  { label: 'Checklist', to: '/app/checklist' },
  { label: 'Controle de acesso', to: '/app/controle-acesso' },
]

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <a className="brand brand-light" href="/app" aria-label="QCAcesso, dashboard">
        <span className="brand-mark">QCA<span className="brand-dot">.</span></span>
        <span className="brand-name">ACESSO</span>
      </a>
      <nav>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}>
            <span aria-hidden="true">▦</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
