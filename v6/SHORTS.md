# 08 — CORTE VERTICAL (TikTok, Facebook Reels, YouTube Shorts) — studio v6.3 "modo Shorts"

**Para a IA que monta os vídeos (Muse/Claude):** o corte vertical de 2 min é feito no mesmo studio, com o mesmo
`episode.json` em `"formato": "9x16"`. Desde a v6.3 o studio já arruma sozinho o que o app cobre na tela; o que
continua sendo trabalho de roteiro e montagem está na receita e na checagem abaixo.

## 1. O que o studio faz sozinho no 9:16 (v6.3)
- **Zona segura:** o TikTok e o Reels cobrem o topo (abas, LIVE, busca: até ~220 px), a base (legenda do post,
  @ e som: abaixo de ~1440 px) e a coluna de botões à direita (x > ~940 px, de ~700 a ~1440 px). Texto e gags
  ficam dentro da caixa x 72–948, y 262–1400.
- **Etiqueta de data:** canto superior direito, descida para y 280 (abaixo das abas).
- **Nome do personagem:** canto superior esquerdo, y 280, encolhe se o nome for comprido.
- **Mapa:** no alto, abaixo das abas, sem encostar na etiqueta de data.
- **Cartão, carimbo, calendário, review e placa:** encaixados automaticamente dentro da zona segura (nada sai cortado
  da tela). `"pv"` continua valendo como posição preferida; sem `"pv"`, a posição do 16:9 é convertida.
- **Legenda:** cada bloco vira pedaços de até 3 palavras (~18 letras), fonte grande e fixa, um pouco à esquerda do
  centro (longe dos botões), na altura y ≈ 1270. Palavra com hífen nunca é partida ("tooth-puller", "brand-new").
- **Câmera:** mantém o Sam entre x 380 e 700 da tela (a não ser que a cena fixe `fxv`). Para desligar numa cena:
  `"camera": {"seguir": false, …}`.
- **Espiar:** no 9:16 o Sam espia pela esquerda (a direita fica sob os botões). Para forçar: `"ladoV": "direita"`.
- **Nada se atropela:** no 9:16 cada gag desvia da etiqueta de data, do nome, do mapa, do gancho, do rosto do Sam e
  da faixa da legenda (desce; se não couber, sobe). O nome e o mapa esperam o gancho sair da tela.
- **Prévia:** a opção "Mostrar onde o TikTok/Reels cobre a tela" pinta as zonas na prévia; não sai no vídeo nem no PNG.

## 2. Novidades no episode.json
- **Gancho escrito na tela (obrigatório no 9:16):**
  `{"tipo": "gancho", "t0": 0, "t1": 2.8, "txt": "BRAZIL WAS\nFOUNDED BY\nACCIDENT", "destaque": ["ACCIDENT"]}`
  (letras grandes, `\n` quebra a linha, `destaque` pinta palavras de amarelo; `"y"` muda a altura).
- **Troca de figurino no meio da cena:** chave `{"t": 4.6, "figurino": "imperador"}` (com o efeito `poeira`).
- **Cena séria:** `"ritmo": "livre"` na cena desliga o aviso de ritmo (escravidão, guerra, fome: sem gag).
- **Só no vertical:** `"so": "9x16"` em qualquer evento (ex.: o gancho) faz ele aparecer só no corte vertical; o
  episódio longo 16:9 continua igual. Para um corte de câmera só no vertical, repita na chave os valores do 16:9 e
  mude apenas `zoomv`/`fxv`.

## 3. Checagem automática (painel 4 — meta: zero ⚠)
- **Ritmo:** avisa quando passa tempo demais sem nada novo na tela — 9:16: 5 s; 16:9: 8 s. Conta como "novo":
  troca de cena, chave de câmera (corte/zoom), punch, tremida, gag/overlay, efeito, ação do Sam (andar, susto,
  sair, espiar) e troca de figurino ou objeto. Mudar só a pose não conta.
- **Data:** avisa quando a narração diz um ano (ex.: 1889) e a etiqueta mostra outro, e quando a narração diz
  "today" com a etiqueta ainda num ano antigo (use `"TODAY"`).
- **Gancho:** avisa se o 9:16 não abre com o gancho escrito na tela.

## 4. Receita do corte de 2 min
1. **0–3 s — gancho:** frase escrita na tela + a imagem mais forte do episódio. Nada de 10 s de apresentação parada.
2. **3–10 s — promessa:** "I'm Sam. Two minutes. Let's ruin [país]." Já com 2–3 mudanças na tela (troca de
   figurino, punch, corte para close).
3. **Miolo — uma batida a cada 3–5 s:** alternar plano aberto e close; punch na piada; gag (carimbo, cartão, placa,
   calendário, review) no máximo a cada 8–10 s para não cansar; cada época com a sua etiqueta de data.
4. **Cenas sérias:** sem gag, sem Sam fantasiado; só movimento de câmera lento e um corte de enquadramento.
5. **Últimos 15 s — montagem:** a lista final ("today…") vira trocas rápidas de figurino e callbacks das gags do
   começo (a placa DETOUR cai de novo, a árvore, os figurinos de cada época a cada 0,3–0,5 s).
6. **Fim — voto:** cartão "VOTE! 1 … · 2 … · 3 …" + a piada final. Terminar seco ajuda o vídeo a recomeçar (loop).

## 5. Exportação e publicação
- 1080×1920, 30 fps, H.264 **yuv420p** (não "yuvj420p"), áudio AAC, −14 LUFS e true peak ≤ −1 dB.
  O melhor é o render headless (`render.mjs … --formato 9x16`); gravando pelo navegador, deixe a aba visível.
- **Capa:** um quadro com o gancho escrito e o Sam de frente.
- **Legenda do post:** uma pergunta + o voto ("Which country should Sam ruin next? 1 Rome 2 India 3 Texas").
  Facebook: no máximo 4 hashtags. Fixar um comentário com o voto.
- **Som (opcional):** uma música do próprio app em volume bem baixo (10–15%) por baixo da narração.
- **Nada é postado sem a aprovação explícita do Timothy.**

## 6. Exemplo: correções do "Brazil 2 min" (brazil-v6-2min-9x16.mp4, 21/11/2026)
O vídeo está bom de conteúdo (história, piadas, Sam vivo, escravidão tratada com seriedade), mas precisa de mais
uma passada antes de postar:
1. **Renderizar de novo no studio v6.3** (mesmo link): já resolve etiqueta de data e nomes sob as abas, carimbo
   (24 s) e placa DETOUR (28 s) cortados, legenda que encolhe e invade os botões, "tooth -puller" e "-new capital",
   e o Sam colado na direita no convés (19–23 s).
2. **Gancho** de 0 a 2,8 s: `"BRAZIL WAS\nFOUNDED BY\nACCIDENT"`, destaque `ACCIDENT`.
3. **Abertura parada (0–14 s):** troca para `imperador` em "empire" e para `rei` em "kingdom", punch em "bossed",
   volta para `eua` com corte para close em "I'm Sam".
4. **Datas** (hoje ficam paradas): 1550 no açúcar/escravidão (40 s), 1700 no ouro (50 s), 1789 em Tiradentes,
   1840 no Pedro II (78 s), 1889 na República (90 s), TODAY no final (101 s), sem etiqueta no voto.
5. **Navio (40–50 s):** continua sério e sem gag; `"ritmo": "livre"`, zoom lento e um corte de enquadramento em ~45 s.
6. **Pedro I (66–78 s):** punch em "drew his sword", corte para close em "Brazil's first ruler?", punch em "family style".
7. **"Today" (101–116 s, 15 s parado):** cartão "200,000,000+"; `jogador` + `taca` em "five World Cup"; `carnaval` em
   "a culture the whole planet copies"; corte para a árvore em "named after a tree"; a placa DETOUR cai de novo em
   "founded by a detour"; `tupi` → `colono` → `rei` → `imperador` a cada 0,4 s em "raised by everyone who showed up";
   carimbo "IMPROVISED" em "So Brazil improvised".
8. **Exportar** em yuv420p (este saiu yuvj420p).
