// DTO público de public.usuarios; perfil_usuario definido em schema.sql.
export const PERFIS = ['ADMIN', 'RH', 'SUPERVISOR', 'AUDITOR'] as const
export type PerfilUsuario = (typeof PERFIS)[number]
export interface UsuarioAutenticado { id: string; nome: string; email: string; perfil: PerfilUsuario }
export const perfilLabels: Record<PerfilUsuario, string> = {
  ADMIN: 'Administrador', RH: 'Recursos Humanos', SUPERVISOR: 'Supervisor', AUDITOR: 'Auditor',
}
