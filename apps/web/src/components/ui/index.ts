/**
 * Primitivos de UI do app. Toda tela importa daqui:
 *
 *   import { Botao, Card, Campo } from "../components/ui";
 *
 * Regra da Etapa 6: nenhuma tela nova escreve `rounded-xl border border-...`
 * na mão. Se falta uma variante, ela nasce aqui e vale para o app inteiro.
 */

export { Botao, BotaoLink, type BotaoProps, type VarianteBotao, type TamanhoBotao } from "./Botao";
export { Card, CardCabecalho } from "./Card";
export { Campo, CampoSelect, CampoTextoLongo, type CampoProps } from "./Campo";
export { CampoSenha } from "./CampoSenha";
export { Badge, BadgeConfirmacao, type TomBadge } from "./Badge";
export { Alerta, type TipoAlerta } from "./Alerta";
export { Modal, ConfirmarAcao } from "./Modal";
export { MenuAcoes, type AcaoDoMenu } from "./MenuAcoes";
export { Alternador, type OpcaoAlternador } from "./Alternador";
export { EstadoVazio } from "./EstadoVazio";
export { Esqueleto, EsqueletoLista } from "./Esqueleto";
export { NumeroContando } from "./NumeroContando";
export { TituloPagina, Secao } from "./Tipografia";
