// DTO público de public.usuarios; perfil_usuario definido em schema.sql.
export const PERFIS = ['ADMIN', 'RH', 'SUPERVISOR', 'AUDITOR', 'TECNOLOGIA'] as const
export type PerfilUsuario = (typeof PERFIS)[number]
export interface UsuarioAutenticado { id: string; nome: string; email: string; perfil: PerfilUsuario }
export const perfilLabels: Record<PerfilUsuario, string> = {
  ADMIN: 'Administrador', RH: 'Recursos Humanos', SUPERVISOR: 'Supervisor', AUDITOR: 'Auditor', TECNOLOGIA: 'Tecnologia',
}

// Página inicial de cada perfil: o Dashboard é restrito, então quem não o acessa
// entra direto na própria área de trabalho.
const rotasIniciais: Partial<Record<PerfilUsuario, string>> = { RH: '/app/uploads', TECNOLOGIA: '/app/tecnologia' }
export function rotaInicial(perfil: PerfilUsuario): string { return rotasIniciais[perfil] ?? '/app' }
