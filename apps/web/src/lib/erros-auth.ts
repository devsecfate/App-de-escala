/**
 * Tradução das mensagens do Supabase Auth.
 *
 * Até agora o `error.message` cru chegava na tela: quem errava a senha lia
 * "Invalid login credentials" — em inglês, e sem dizer se o problema era o
 * e-mail ou a senha. É a primeira tela do app e a maior parte da igreja não lê
 * inglês.
 *
 * O casamento é por trecho porque o Supabase muda o texto entre versões e às
 * vezes anexa detalhes ao fim da frase.
 */

const TRADUCOES: [RegExp, string][] = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Este e-mail ainda não foi confirmado."],
  [/user already registered|already been registered/i,
    "Já existe uma conta com este e-mail. Tente entrar, ou use “Esqueci minha senha”."],
  [/password should be at least (\d+)/i, "A senha precisa ter pelo menos $1 caracteres."],
  [/password.*(weak|requirements)/i, "Escolha uma senha mais forte."],
  [/new password should be different/i, "A senha nova precisa ser diferente da atual."],
  [/unable to validate email|invalid format/i, "E-mail inválido. Confira se digitou certo."],
  [/for security purposes, you can only request this after (\d+) seconds?/i,
    "Aguarde $1 segundos antes de tentar de novo."],
  [/email rate limit exceeded|over_email_send_rate_limit/i,
    "Muitas tentativas seguidas. Espere alguns minutos e tente de novo."],
  [/request rate limit|too many requests/i, "Muitas tentativas seguidas. Espere um pouco."],
  [/signups not allowed|signup is disabled/i, "O cadastro está desativado neste momento."],
  [/auth session missing/i, "Sua sessão expirou. Entre de novo."],
  [/token has expired|invalid.*token/i, "Este link expirou. Peça um novo."],
  [/failed to fetch|network ?error|load failed/i,
    "Não foi possível falar com o servidor. Confira sua internet."],
];

export function traduzirErroAuth(mensagem: string | null | undefined): string {
  if (!mensagem) return "Não foi possível concluir. Tente de novo.";

  for (const [padrao, traducao] of TRADUCOES) {
    if (padrao.test(mensagem)) {
      return mensagem.replace(padrao, traducao);
    }
  }

  return mensagem;
}

/**
 * Mesma tradução, partindo de um erro solto (catch).
 *
 * O teste `instanceof Error` sozinho não serve: o PostgREST devolve um objeto
 * simples (`{ code, message, details, hint }`), não uma instância de `Error`.
 * Com só ele, toda mensagem que o banco escreve em português — "Este convite
 * venceu.", "Código não encontrado." — era engolida e virava o texto genérico
 * de alternativa, que é justamente o que a Etapa 6 queria acabar.
 */
export function mensagemDeErro(erro: unknown, alternativa = "Não foi possível concluir."): string {
  if (typeof erro === "string") return traduzirErroAuth(erro);

  if (erro && typeof erro === "object" && "message" in erro) {
    const mensagem = (erro as { message?: unknown }).message;
    if (typeof mensagem === "string" && mensagem.trim()) return traduzirErroAuth(mensagem);
  }

  return alternativa;
}
