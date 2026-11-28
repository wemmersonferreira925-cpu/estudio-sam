# Sam Studio v7 — formato do ROTEIRO (JSON)

O roteiro **não tem tempos**. Cada bloco tem a `fala` do Sam e o que acontece na tela, preso a uma **palavra** dessa fala. O estúdio calcula os tempos: pela narração (alinhamento automático) ou, sem narração, estimando ≈2,6 palavras por segundo.

## Topo do arquivo

```json
{
  "versao": "7",
  "titulo": "What Happens To Your Body When You Skip Sleep",
  "formato": "9x16",
  "estilo3d": "A",
  "sam_padrao": { "x": 560, "chao": 1010, "escala": 1.12, "pose": "maos_na_cintura", "expressao": "deadpan" },
  "blocos": [ ... ]
}
```

| campo | o que é |
|---|---|
| `versao` | sempre `"7"` |
| `titulo` | título em inglês |
| `formato` | `"9x16"` (padrão do canal) |
| `estilo3d` | `"A"` (desenho 3D com contorno) |
| `sam_padrao` | onde o Sam fica: `x` 300–900, `chao` 960–1040, `escala` 1.0–1.25; pose e expressão iniciais |
| `voz` | (opcional) nome do arquivo da narração |
| `musica` | (opcional) `{ "arquivo": "trilha.mp3", "volume": 0.12 }`. A música abaixa sozinha quando o Sam fala |
| `ritmo` | (opcional) velocidade estimada da fala sem narração (1 = normal) |
| `aviso_medico` | (opcional) `false` tira o aviso "not medical advice" do início. Deixe ligado |
| `sfx_auto` | (opcional) `false` desliga os sons automáticos dos cartões |
| `duracao_alvo` | (opcional) faixa de duração conferida pelo estúdio. Padrão no 9:16: `[61, 90]` segundos |

## Um bloco

```json
{
  "fala": "Twenty-four hours? Point one zero. That's over the legal driving limit, and you didn't even have fun.",
  "cena": { "cenario": "estudio" },
  "transicao": "whip",
  "tag": "HOUR 24",
  "camera": "geral",
  "sam": [ { "pose": "bracos_cruzados", "expressao": "julgando" }, { "palavra": "fun", "pose": "sarcasmo", "expressao": "sarcastico" } ],
  "acoes": [ { "tipo": "susto", "palavra": "fun" } ],
  "tela": [
    { "tipo": "alerta", "palavra": "Point", "ate": "limit", "txt": "24 hours awake ≈ 0.10% blood alcohol. U.S. limit: 0.08%", "fonte": "CDC / NIOSH" },
    { "tipo": "carimbo", "palavra": "fun", "txt": "ZERO FUN", "cor": "vermelho" }
  ],
  "sfx": [ { "som": "scratch", "palavra": "fun" } ]
}
```

| campo | o que é |
|---|---|
| `fala` | **obrigatório**. O que o Sam fala, em inglês, 1 a 3 frases. Números como devem ser lidos na tela: "0.05%", "7+" |
| `cena` | começa uma cena nova neste bloco (veja abaixo). O 1º bloco sempre tem cena |
| `transicao` | `corte` (padrão), `whip` (chicote) ou `fade` |
| `tag` | etiqueta no canto: `"HOUR 17"`, `"DAY 3"`, `"MYTH #2"`. Fica até outra tag; `""` apaga |
| `camera` | `push`, `pull`, `geral`, `medio`, `perto`, `rosto` ou `{ "tipo": "punch", "palavra": "…" }` / `{ "tipo": "tremer", "palavra": "…" }` |
| `sam` | lista de mudanças do Sam. Sem `palavra` = no começo do bloco. Campos: `pose`, `expressao`, `olhar` (−1 esquerda … 1 direita), `olharY`, `prancha` (`"hemacia"`), `andar_para` (x), `visivel` |
| `acoes` | `susto`, `piscar`, `espiar` (`lado`: `esquerda`/`direita`, `dur`), `andar` (`x`), `sair` |
| `tela` | o que aparece na tela (tipos abaixo) |
| `sfx` | sons extras `{ "som": "…", "palavra": "…", "vol": 0.6 }` |

**Palavras:** `palavra` marca quando começa; `ate` marca quando termina (ou `dur` em segundos). A palavra tem de estar na `fala` do mesmo bloco (maiúscula/minúscula não importa; pode ser duas palavras: `"delete button"`; `"n": 2` pega a 2ª vez que aparece).

## Cenas

| cena | o que é |
|---|---|
| `{ "cenario": "estudio" }` | estúdio azul-petróleo com hélice de DNA girando e telão (monitor cardíaco). `"tela": "clip.mp4"` põe um clipe ou imagem no telão |
| `{ "cenario": "arteria" }` | dentro de uma artéria, hemácias passando. Use com `"sam": [{ "prancha": "hemacia" }]` (o Sam surfa numa hemácia). Âncoras para rótulo: `celula1`, `celula2`, `celula3`, `globulo_branco` |
| `{ "video": "clip.mp4" }` | o clipe (Grok Imagine/Flow) ocupa a tela toda, com o Sam por cima. Use `"sam": false` dentro da cena para sumir com ele |
| `{ "fundo": "imagem.jpg" }` | imagem parada de fundo |

Dentro de `cena` também valem: `"sam": { "x": 520, "chao": 900 }` (posição nesta cena), `"luz": "neutro" | "arteria" | "noite" | "quente"`, `"fluxo": 1.5` (velocidade das hemácias), `"voo": 1.2` (câmera avançando pela artéria).

## O que aparece na tela (`tela`)

| tipo | campos | uso |
|---|---|---|
| `gancho` | `txt` (use `\n`), `destaque` [palavras amarelas], `"so": "9x16"` | frase gigante dos 2–3 primeiros segundos |
| `alerta` | `txt`, `titulo` (padrão "HEALTH RISK"), `fonte` | risco à saúde (faixa vermelha, treme ao entrar) |
| `cuidado` | `txt`, `titulo` (padrão "DO THIS"), `fonte` | o que fazer (faixa verde) |
| `fato` | `txt`, `titulo` (padrão "FACT"), `fonte` | curiosidade com fonte (faixa azul) |
| `numero` | `de`, `ate`, `casas`, `prefixo`, `sufixo`, `txt` | contador gigante: `"ate": 25, "sufixo": " TRILLION"` |
| `lista` | `titulo`, `estilo` (`cuidado`/`risco`), `itens` [{ `txt`, `palavra` }] | lista que vai marcando item por item |
| `rotulo` | `txt`, `alvo` | etiqueta com seta. `alvo`: âncora do cenário, `"tela"`, `"sam"`, `"mao"` ou `[x, y]` |
| `carimbo` | `txt`, `cor` (`vermelho`, `verde`, `azul`, `laranja`, `roxo`), `sub` | "MYTH", "TRUE", "PAID", "NOPE" |
| `nome` | `nome`, `sub` | apresenta um órgão como personagem: "THE LIVER" / "your 24/7 detox plant" |
| `cartao` | `txt`, `icone` | balão curto de piada |
| `placa` | `txt`, `seta` | placa de aviso |
| `review` | `nome`, `sub`, `estrelas` (0–5), `app` | avaliação engraçada: "1 ★ — would not recommend. — your liver" |

## Catálogo

**Poses:** idle, apontar, apontar_lado, apontar_esq, apontar_cima, dar_de_ombros, maos_ao_alto, susto, comemorar, rezar, reverencia, segurar_mapa, maos_na_cintura, reivindicar, acenar, segurar_lanca, erguer, segurar, assinar, sarcasmo, sarcasmo_esq, bracos_cruzados, explicar, explicar_esq

**Expressões:** deadpan, serio, neutro, falando, cetico, sorriso, orgulhoso, surpreso, assustado, feliz, olhos_fechados, irritado, sarcastico, revirando, julgando, preocupado

**Câmera:** push, pull, geral, medio, perto, rosto, punch, tremer

**Sons:** whoosh, whoosh_leve, pop, ding, carimbo, alerta, tick, boing, coracao, scratch, plim, erro, sucesso, riser, impacto (os cartões já tocam um som sozinhos)

**Cenários 3D:** estudio, arteria

## Receita de 61–90 s que prende (150 a 210 palavras faladas)

1. **Gancho (0–3 s):** `gancho` + fala que fala do corpo de quem assiste. Câmera `push`.
2. **Promessa (3–6 s):** pergunta aberta ("the last one is the scary one").
3. **Escada (6–80 s):** 3 a 6 degraus que pioram (hora a hora, dia a dia, mito vs fato). Cada degrau: 1 cartão ou contador + 1 piada do Sam + troca de câmera/pose. Use `tag` para o degrau.
4. **Virada (meio):** "But that's not even the worst part." + `alerta`.
5. **Cuidados (fim):** `lista` estilo cuidado com 2 a 4 itens práticos.
6. **Fecho:** resposta da pergunta aberta + piada que chama de volta o começo, com `carimbo` e câmera `rosto`.

## Exemplo completo

Veja `exemplo-roteiro.json` (o episódio da demo: "What Happens To Your Body When You Skip Sleep"). Ele tem só 42 s porque é um teste do estúdio (`"duracao_alvo": [30, 90]`); os episódios do canal têm de 61 a 90 s.
