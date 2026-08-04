/**
 * Gera os ícones PNG do PWA a partir do mesmo desenho de public/pwa-icon.svg.
 *
 *   node scripts/gerar-icones.mjs
 *
 * Existe porque instalar o app no celular pede PNG: o iOS ignora ícone SVG no
 * apple-touch-icon e o Android precisa de uma versão "maskable" (com margem de
 * segurança) para não cortar o desenho ao aplicar a máscara do sistema.
 *
 * Sem dependência de rasterizador: o desenho é feito de retângulos
 * arredondados e segmentos de reta, que dá para resolver ponto a ponto. O
 * antisserrilhado sai de 4x4 amostras por pixel.
 *
 * Rodar de novo só é necessário quando o desenho do ícone mudar; os PNGs
 * ficam versionados junto com o resto.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = join(RAIZ, "public");

const FUNDO = [15, 118, 110, 255]; // #0f766e, o mesmo theme_color do manifest
const BRANCO = [255, 255, 255, 255];
const VERDE = [94, 234, 212, 255]; // #5eead4 — verde-água da marca; o #22c55e
// antigo sumia contra o azul-petróleo do fundo novo.
const TRANSPARENTE = [0, 0, 0, 0];

// O desenho vive num quadrado de 64x64, como o viewBox do SVG.
const LADO = 64;
const CENTRO = LADO / 2;

/** Ponto dentro de um retângulo de cantos arredondados. */
function dentroDoRetangulo(px, py, x, y, largura, altura, raio) {
  if (px < x || py < y || px > x + largura || py > y + altura) return false;
  const dx = Math.max(x + raio - px, 0, px - (x + largura - raio));
  const dy = Math.max(y + raio - py, 0, py - (y + altura - raio));
  return dx * dx + dy * dy <= raio * raio;
}

/** Distância do ponto até o segmento de reta (para traços com ponta redonda). */
function distanciaAteSegmento(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const comprimento = vx * vx + vy * vy;
  const t = comprimento === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / comprimento));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

/**
 * As formas do desenho, da mais ao fundo para a mais à frente. Cada uma
 * responde se contém o ponto; a última que contiver define a cor.
 */
const FORMAS = [
  // Moldura do calendário (retângulo vazado: o de fora menos o de dentro).
  {
    cor: BRANCO,
    contem: (x, y) =>
      dentroDoRetangulo(x, y, 14, 16, 36, 34, 4) && !dentroDoRetangulo(x, y, 15.5, 17.5, 33, 31, 2.5),
  },
  // Linha do cabeçalho do calendário.
  { cor: BRANCO, contem: (x, y) => x >= 14 && x <= 50 && y >= 24.5 && y <= 27.5 },
  // As duas argolas em cima.
  { cor: BRANCO, contem: (x, y) => distanciaAteSegmento(x, y, 22, 12, 22, 20) <= 1.5 },
  { cor: BRANCO, contem: (x, y) => distanciaAteSegmento(x, y, 42, 12, 42, 20) <= 1.5 },
  // O "confirmado": traço verde em forma de check.
  {
    cor: VERDE,
    contem: (x, y) =>
      distanciaAteSegmento(x, y, 22, 38, 28, 44) <= 2 || distanciaAteSegmento(x, y, 28, 44, 40, 32) <= 2,
  },
];

/**
 * Cor de um ponto do desenho, em coordenadas de 0 a 64.
 * `escalaDoConteudo` encolhe tudo em volta do centro (usado no maskable);
 * `fundoInteiro` preenche o quadrado todo em vez do retângulo arredondado.
 */
function corNoPonto(x, y, { escalaDoConteudo, fundoInteiro }) {
  const fundo = fundoInteiro ? FUNDO : dentroDoRetangulo(x, y, 0, 0, LADO, LADO, 14) ? FUNDO : TRANSPARENTE;

  // O conteúdo é testado nas coordenadas originais: em vez de mover as formas,
  // move-se o ponto para dentro delas.
  const cx = (x - CENTRO) / escalaDoConteudo + CENTRO;
  const cy = (y - CENTRO) / escalaDoConteudo + CENTRO;

  for (let i = FORMAS.length - 1; i >= 0; i -= 1) {
    if (FORMAS[i].contem(cx, cy)) return FORMAS[i].cor;
  }
  return fundo;
}

const AMOSTRAS = 4; // 4x4 amostras por pixel

function desenhar(tamanho, opcoes) {
  const pixels = Buffer.alloc(tamanho * tamanho * 4);
  const passo = LADO / tamanho;

  for (let py = 0; py < tamanho; py += 1) {
    for (let px = 0; px < tamanho; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < AMOSTRAS; sy += 1) {
        for (let sx = 0; sx < AMOSTRAS; sx += 1) {
          const x = (px + (sx + 0.5) / AMOSTRAS) * passo;
          const y = (py + (sy + 0.5) / AMOSTRAS) * passo;
          const cor = corNoPonto(x, y, opcoes);
          // Soma com alfa pré-multiplicado para a borda transparente não
          // puxar as cores para preto.
          const alfa = cor[3] / 255;
          r += cor[0] * alfa;
          g += cor[1] * alfa;
          b += cor[2] * alfa;
          a += cor[3];
        }
      }

      const total = AMOSTRAS * AMOSTRAS;
      const alfaMedio = a / total;
      const posicao = (py * tamanho + px) * 4;
      const desfazPreMultiplicacao = alfaMedio === 0 ? 0 : 255 / alfaMedio;
      pixels[posicao] = Math.round((r / total) * desfazPreMultiplicacao);
      pixels[posicao + 1] = Math.round((g / total) * desfazPreMultiplicacao);
      pixels[posicao + 2] = Math.round((b / total) * desfazPreMultiplicacao);
      pixels[posicao + 3] = Math.round(alfaMedio);
    }
  }

  return pixels;
}

// --- PNG -------------------------------------------------------------------

const TABELA_CRC = (() => {
  const tabela = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c;
  }
  return tabela;
})();

function crc32(dados) {
  let c = 0xffffffff;
  for (const byte of dados) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const cabecalho = Buffer.alloc(4);
  cabecalho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const verificacao = Buffer.alloc(4);
  verificacao.writeUInt32BE(crc32(corpo));
  return Buffer.concat([cabecalho, corpo, verificacao]);
}

function gravarPng(caminho, tamanho, pixels) {
  const larguraDaLinha = tamanho * 4;
  // Cada linha do PNG começa com o byte do filtro (0 = nenhum).
  const bruto = Buffer.alloc((larguraDaLinha + 1) * tamanho);
  for (let y = 0; y < tamanho; y += 1) {
    bruto[y * (larguraDaLinha + 1)] = 0;
    pixels.copy(bruto, y * (larguraDaLinha + 1) + 1, y * larguraDaLinha, (y + 1) * larguraDaLinha);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compressão deflate
  ihdr[11] = 0; // filtro padrão
  ihdr[12] = 0; // sem entrelaçamento

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(bruto, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);

  writeFileSync(caminho, png);
  return png.length;
}

// --- geração ---------------------------------------------------------------

const ICONES = [
  { arquivo: "pwa-192.png", tamanho: 192, escalaDoConteudo: 1, fundoInteiro: false },
  { arquivo: "pwa-512.png", tamanho: 512, escalaDoConteudo: 1, fundoInteiro: false },
  // Maskable: fundo até a borda e conteúdo dentro da zona segura (80% do lado),
  // porque o Android recorta o ícone no formato que quiser.
  { arquivo: "pwa-maskable-512.png", tamanho: 512, escalaDoConteudo: 0.72, fundoInteiro: true },
  // O iOS aplica o próprio arredondamento e não entende transparência: fundo cheio.
  { arquivo: "apple-touch-icon.png", tamanho: 180, escalaDoConteudo: 1, fundoInteiro: true },
];

mkdirSync(DESTINO, { recursive: true });

for (const icone of ICONES) {
  const pixels = desenhar(icone.tamanho, {
    escalaDoConteudo: icone.escalaDoConteudo,
    fundoInteiro: icone.fundoInteiro,
  });
  const bytes = gravarPng(join(DESTINO, icone.arquivo), icone.tamanho, pixels);
  console.log(`${icone.arquivo.padEnd(24)} ${icone.tamanho}x${icone.tamanho}  ${bytes} bytes`);
}
