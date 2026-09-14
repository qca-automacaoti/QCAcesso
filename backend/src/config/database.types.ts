import type { PerfilUsuario, Usuario } from '../modules/auth/auth.types';

// Subconjunto do schema.sql utilizado exclusivamente pela Fase 1.
export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: Usuario;
        Insert: { id: string; nome: string; email: string; perfil?: PerfilUsuario; ativo?: boolean; created_at?: string };
        Update: { nome?: string; email?: string; perfil?: PerfilUsuario; ativo?: boolean };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { perfil_usuario: PerfilUsuario };
    CompositeTypes: { [_ in never]: never };
  };
}
