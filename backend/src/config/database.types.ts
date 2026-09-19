import type { PerfilUsuario, Usuario } from '../modules/auth/auth.types';

export type StatusFuncionario = 'ATIVO' | 'DE_FERIAS' | 'BLOQUEADO';
export type StatusUpload = 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
export type StatusRevisao = 'PENDENTE' | 'EDITADO' | 'CONFIRMADO' | 'REJEITADO';
export type StatusPeriodo = 'CONFIRMADO' | 'CANCELADO' | 'CONCLUIDO';
export type TipoAcao = 'BLOQUEIO' | 'DESBLOQUEIO';
export type StatusControle = 'PENDENTE' | 'CONFIRMADO' | 'ATRASADO' | 'CANCELADO';
export type TipoAlerta = 'LEMBRETE_BLOQUEIO' | 'LEMBRETE_DESBLOQUEIO' | 'ESCALONAMENTO_ATRASO';
export type StatusEnvio = 'ENVIADO' | 'FALHA';
export type TipoEvento =
  | 'UPLOAD'
  | 'EDICAO_CHECKLIST'
  | 'CONFIRMACAO_BLOQUEIO'
  | 'CONFIRMACAO_DESBLOQUEIO'
  | 'ENVIO_ALERTA'
  | 'CONFIGURACAO_ALTERADA';

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: Usuario;
        Insert: { id: string; nome: string; email: string; perfil?: PerfilUsuario; ativo?: boolean; created_at?: string };
        Update: { nome?: string; email?: string; perfil?: PerfilUsuario; ativo?: boolean };
        Relationships: [];
      };
      funcionarios: {
        Row: {
          id: string;
          empresa: string;
          cadastro: string;
          nome: string;
          email: string | null;
          supervisor_id: string | null;
          status_atual: StatusFuncionario;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          empresa: string;
          cadastro: string;
          nome: string;
          email?: string | null;
          supervisor_id?: string | null;
          status_atual?: StatusFuncionario;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          empresa?: string;
          cadastro?: string;
          nome?: string;
          email?: string | null;
          supervisor_id?: string | null;
          status_atual?: StatusFuncionario;
          updated_at?: string;
        };
        Relationships: [];
      };
      upload_planilhas: {
        Row: {
          id: string;
          nome_arquivo: string;
          usuario_id: string;
          data_upload: string;
          total_linhas: number;
          linhas_processadas: number;
          linhas_com_erro: number;
          status: StatusUpload;
        };
        Insert: {
          id?: string;
          nome_arquivo: string;
          usuario_id: string;
          data_upload?: string;
          total_linhas?: number;
          linhas_processadas?: number;
          linhas_com_erro?: number;
          status?: StatusUpload;
        };
        Update: {
          total_linhas?: number;
          linhas_processadas?: number;
          linhas_com_erro?: number;
          status?: StatusUpload;
        };
        Relationships: [];
      };
      checklist_revisao: {
        Row: {
          id: string;
          upload_id: string;
          funcionario_id: string | null;
          empresa: string;
          cadastro: string;
          nome: string;
          data_inicio: string;
          data_fim: string;
          status_revisao: StatusRevisao;
          revisado_por: string | null;
          revisado_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          upload_id: string;
          funcionario_id?: string | null;
          empresa: string;
          cadastro: string;
          nome: string;
          data_inicio: string;
          data_fim: string;
          status_revisao?: StatusRevisao;
          revisado_por?: string | null;
          revisado_em?: string | null;
          created_at?: string;
        };
        Update: {
          funcionario_id?: string | null;
          empresa?: string;
          cadastro?: string;
          nome?: string;
          data_inicio?: string;
          data_fim?: string;
          status_revisao?: StatusRevisao;
          revisado_por?: string | null;
          revisado_em?: string | null;
        };
        Relationships: [];
      };
      periodos_ferias: {
        Row: {
          id: string;
          funcionario_id: string;
          checklist_origem_id: string | null;
          data_inicio: string;
          data_fim: string;
          status: StatusPeriodo;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          funcionario_id: string;
          checklist_origem_id?: string | null;
          data_inicio: string;
          data_fim: string;
          status?: StatusPeriodo;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          data_inicio?: string;
          data_fim?: string;
          status?: StatusPeriodo;
          updated_at?: string;
        };
        Relationships: [];
      };
      controle_acesso: {
        Row: {
          id: string;
          periodo_ferias_id: string;
          tipo_acao: TipoAcao;
          data_programada: string;
          status: StatusControle;
          supervisor_id: string | null;
          confirmado_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          periodo_ferias_id: string;
          tipo_acao: TipoAcao;
          data_programada: string;
          status?: StatusControle;
          supervisor_id?: string | null;
          confirmado_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: StatusControle;
          supervisor_id?: string | null;
          confirmado_em?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      alertas: {
        Row: {
          id: string;
          controle_acesso_id: string;
          supervisor_id: string | null;
          destinatario_id: string | null;
          tipo_alerta: TipoAlerta;
          chave_idempotencia: string | null;
          data_envio: string;
          status_envio: StatusEnvio;
        };
        Insert: {
          id?: string;
          controle_acesso_id: string;
          supervisor_id?: string | null;
          destinatario_id?: string | null;
          tipo_alerta: TipoAlerta;
          chave_idempotencia?: string | null;
          data_envio?: string;
          status_envio?: StatusEnvio;
        };
        Update: { status_envio?: StatusEnvio };
        Relationships: [];
      };
      logs_atividade: {
        Row: {
          id: string;
          usuario_id: string | null;
          tipo_evento: TipoEvento;
          entidade_afetada: string | null;
          entidade_id: string | null;
          descricao: string | null;
          data_hora: string;
        };
        Insert: {
          id?: string;
          usuario_id?: string | null;
          tipo_evento: TipoEvento;
          entidade_afetada?: string | null;
          entidade_id?: string | null;
          descricao?: string | null;
          data_hora?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      editar_checklist_revisao: {
        Args: {
          p_checklist_id: string;
          p_empresa: string;
          p_cadastro: string;
          p_nome: string;
          p_data_inicio: string;
          p_data_fim: string;
          p_supervisor_id: string | null;
        };
        Returns: Database['public']['Tables']['checklist_revisao']['Row'];
      };
      rejeitar_checklist_revisao: {
        Args: { p_checklist_id: string };
        Returns: Database['public']['Tables']['checklist_revisao']['Row'];
      };
      confirmar_checklist_revisao: {
        Args: { p_checklist_id: string };
        Returns: Database['public']['Tables']['checklist_revisao']['Row'];
      };
      confirmar_controle_acesso: {
        Args: { p_controle_id: string };
        Returns: Database['public']['Tables']['controle_acesso']['Row'];
      };
      administrar_usuario: {
        Args: { p_usuario_id: string; p_perfil: PerfilUsuario; p_ativo: boolean };
        Returns: Database['public']['Tables']['usuarios']['Row'];
      };
    };
    Enums: {
      perfil_usuario: PerfilUsuario;
      status_funcionario: StatusFuncionario;
      status_upload: StatusUpload;
      status_revisao: StatusRevisao;
      status_periodo: StatusPeriodo;
      tipo_acao: TipoAcao;
      status_controle: StatusControle;
      tipo_alerta: TipoAlerta;
      status_envio: StatusEnvio;
      tipo_evento: TipoEvento;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
