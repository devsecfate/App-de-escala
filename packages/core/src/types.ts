/**
 * Tipos do domínio, espelhando o modelo de dados em planejamento/arquitetura.md.
 * Ids são strings (uuid do Postgres/Supabase).
 */

export type PapelGlobal = "admin" | "membro";
export type PapelMinisterio = "lider" | "membro";
export type StatusEscala = "rascunho" | "publicada";
export type StatusConfirmacao = "pendente" | "confirmado" | "recusado";

export interface Igreja {
  id: string;
  nome: string;
  fusoHorario: string;
}

export interface Perfil {
  id: string;
  igrejaId: string;
  nome: string;
  telefone: string | null;
  email: string;
  papelGlobal: PapelGlobal;
  ativo: boolean;
}

export interface Ministerio {
  id: string;
  igrejaId: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

export interface MembroMinisterio {
  id: string;
  ministerioId: string;
  perfilId: string;
  papel: PapelMinisterio;
  ativo: boolean;
}

export interface Funcao {
  id: string;
  ministerioId: string;
  nome: string;
  obrigatoria: boolean;
}

export interface Evento {
  id: string;
  igrejaId: string;
  titulo: string;
  dataHora: string; // ISO 8601
  tipo: string;
  observacoes: string | null;
}

export interface Escala {
  id: string;
  eventoId: string;
  ministerioId: string;
  status: StatusEscala;
  publicadaEm: string | null;
  criadaPor: string;
}

export interface Escalacao {
  id: string;
  escalaId: string;
  perfilId: string;
  funcaoId: string;
  confirmacao: StatusConfirmacao;
  respondidoEm: string | null;
}

export interface Indisponibilidade {
  id: string;
  perfilId: string;
  dataInicio: string; // ISO date
  dataFim: string | null; // ISO date, null = em aberto
  motivo: string | null;
}

export interface RegraMinisterio {
  id: string;
  ministerioId: string;
  maxEscalasMes: number | null;
  intervaloMinDias: number | null;
  bloquearConflitoEvento: boolean;
}

export interface Musica {
  id: string;
  ministerioId: string;
  titulo: string;
  artista: string | null;
  tom: string | null;
  andamento: string | null;
  categoria: string | null;
  link: string | null;
  ativa: boolean;
  extras: Record<string, unknown>;
}

export interface CategoriaMusica {
  id: string;
  ministerioId: string;
  nome: string;
  ordem: number;
}

/** Coluna extra que o líder criou no repertório; o valor fica em `Musica.extras[chave]`. */
export interface CampoMusica {
  id: string;
  ministerioId: string;
  chave: string;
  rotulo: string;
  ordem: number;
}

export interface CronogramaItem {
  id: string;
  escalaId: string;
  musicaId: string;
  ordem: number;
  tomDoDia: string | null;
  momento: string | null;
  observacao: string | null;
}
