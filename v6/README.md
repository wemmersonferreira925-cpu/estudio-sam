# Sam Studio v6.2 — "Sam vivo" (Sam Ruins History)

**Abrir o studio:** https://wemmersonferreira925-cpu.github.io/estudio-sam/v6/
(abre com a demo de 35 s do Cabral; dá para carregar outro `episode.json`, os fundos e o áudio e exportar o vídeo).

> **For AI assistants (e.g. Muse):** this folder is the production studio of the YouTube channel *Sam Ruins History*.
> Open the link above in Chrome. Load an `episode.json` (format in section 4 below; full example: `episode-exemplo.json`),
> the painted backgrounds **without Sam** (prompt in section 6) and the mastered narration audio, check that
> "Checagem" shows **zero ⚠**, then click **Exportar vídeo** once in 16:9 and once in 9:16. Sam is always drawn by
> the studio (never painted into the backgrounds). Everything on screen and in the narration is in English.

> **New in v6.2:** a wardrobe of **97 ready-made costumes** for many countries, eras and themes, **38 props**,
> custom costumes built from parts inside `episode.json` (section 5), costume changes mid-scene, and a
> **20-episode plan with dates** in `PLANO-20-EPISODIOS.md` / `calendario-20-episodios.json` (Saturdays 12:00 Fortaleza, 28/11/2026 → 10/04/2027).

Arquivos desta pasta: `index.html` (o studio), `sam-engine.js` (motor de animação), `render.mjs` (render
headless em MP4 com Node + Playwright), `alinhar.py` (alinha roteiro ↔ narração e gera a legenda),
`sam_audio.py` (efeitos sonoros, mix, boca e master −14 LUFS), `episode-exemplo.json` (episódio de teste),
`galeria-figurinos.jpg` (os 97 figurinos numa imagem) + `galeria-1.jpg` … `galeria-4.jpg` (maiores),
`PLANO-20-EPISODIOS.md` e `calendario-20-episodios.json` (datas, temas, figurinos, fatos e votos).
**A versão v5.0/v5.1 na raiz do repositório não foi alterada.**

**Aprovado pelo Timothy no teste de 35 s (Cabral): "excelente", "estou gostando muito".**
Arquivos do teste: `episode-exemplo.json` (o episódio de teste) e os vídeos
`teste-sam-vivo-16x9.mp4` / `teste-sam-vivo-9x16.mp4` (entregues no chat).

## 1. O que mudou (e por quê)
Na skin A5 o Sam vinha **pintado dentro** de cada ilustração: lindo, mas parado (só zoom lento,
mesma pose por 20–40 s, sempre sorrindo). O v6 mantém a pintura A5 e tira o Sam de dentro dela:
- **Fundo:** pintura A5 completa **sem o Sam** (cenário + figurantes pequenos ao longe).
- **Sam:** desenhado **por código** por cima (cabeça branca, contorno grosso, deadpan, figurino da
  época, bracinhos/perninhas pretos, mãos-luva), com sombra no chão → pisca, fala (boca sincronizada
  com a voz do Helio), muda de pose/expressão, anda, leva susto, sai correndo, espia pela borda.
- **Deadpan de volta:** a cara padrão é `deadpan` (olhos meio fechados, boca reta). Sorriso/surpresa
  só de propósito, como piada.
- **Gags e explicação na montagem** (nunca dentro da pintura): nome do personagem, mapa com rota
  animada, cartões, carimbo, calendário que conta dias, "review" falsa, placa que cai e balança,
  raios de luz, "!"/"?" sobre a cabeça, brilho, poeira, linhas de velocidade.
- **Câmera viva:** zoom lento, cortes para close, "punch-in" na piada, tremida no impacto, balanço
  no mar, transição "whip" entre cenas.
- **Vertical nativo 9:16:** o mesmo episódio renderiza em 1080×1920 com o Sam grande e centralizado
  e os cartões reposicionados (`pv`), em vez de recortar a faixa central do 16:9.
- **Regras antigas intactas:** Sam travado (camisa dos EUA só na abertura/voto), voz Helio, legenda
  caixa escura + palavra amarela #FFD21F (blocos ≤6 palavras, cortados no fim da frase), etiqueta de
  data no canto superior direito, −14 LUFS / TP ≤ −1 dB, entrega 16:9 + 9:16, voto final de 3 opções.
- **Proibido continua proibido:** IA de vídeo para gerar movimento. Todo movimento do v6 é código.

## 2. Onde está o studio
- **Página do studio (navegador):** artefato "Sam Studio v6 — Sam vivo"
  https://claude.ai/artifact/PhpLcoQhvUaQBZjEmSEZGR (abre com a demo do Cabral; carrega episode.json +
  fundos + áudio; mostra avisos; exporta MP4/WebM em tempo real; salva quadro PNG).
- **Código:** `sam-engine.js` (motor), `index.html` (página completa, funciona
  também aberta direto do computador ou no GitHub Pages do estudio-sam), `render.mjs`
  (render headless quadro a quadro → MP4), `alinhar.py`, `sam_audio.py`.
- **Recomendado:** ligar o GitHub no claude.ai para o código morar no repositório `estudio-sam`
  (ex.: pasta `v6/`). Nunca alterar o arquivo da v5.0.

## 3. Pipeline de um episódio (v6)
1. **Roteiro** (inglês) por capítulos — ver skill de roteiro e arquivo 03. Marcar no roteiro onde
   entra cada gag/explicação.
2. **Narração Helio** (`avocado_v2:MAI_03`, speed 104) → `narracao.wav`.
3. **Alinhamento** (offline, PocketSphinx):
   `python3 alinhar.py narracao.wav roteiro.txt palavras.json`
   - roteiro.txt = texto exatamente narrado; `[exibido|falado]` quando a tela mostra diferente:
     `[1500,|fifteen hundred]`, `[10|ten]`; nomes fora do dicionário com grafia fonética:
     `[Álvares|alvares]`, `[Tiradentes|tee rah den tees]`.
   - gera palavras com tempo e os blocos de legenda já no padrão do canal.
4. **Pinturas A5 SEM o Sam** (1 por lugar/época; 1920×1080 ou 2048×1152), prompt na seção 6.
   O elemento do lugar fica no terço central; chão livre no terço inferior para o Sam.
5. **episode.json** (seção 4): cenas, câmera, Sam (chaves + ações), efeitos, eventos, datas, SFX,
   legenda (colar a saída do alinhador).
6. **Áudio:** `python3 sam_audio.py narracao.wav episode.json pasta/` → `mix.wav` masterizado
   (−14 LUFS, TP −1.5) + `timing.json` (boca por quadro).
7. **Render:** `node render.mjs pasta/ saida-16x9.mp4` e
   `node render.mjs pasta/ saida-9x16.mp4 --formato 9x16` (H.264 CRF 17, AAC 192k).
   Quadros soltos para QC: `--frames 0.5,10.4,22.0`.
8. **QC (mostrar, não só afirmar):** zero ⚠ do catálogo; quadros nos dois formatos; legenda por
   frase; data certa; loudness medido; duração e ppm declarados.

## 4. episode.json v6 (formato)
```json
{
 "versao": "6.0", "titulo": "...", "formato": "16x9", "fps": 30, "duracao": 34.8, "fade_final": 0.35,
 "datas": [{"txt": "1500", "t0": 0, "t1": 34.8, "pulso": 6.0}],
 "sfx": [["bonk", 10.22, 0.85], ["ding", 24.9, 0.45]],
 "cenas": [{
   "id": "convés", "inicio": 0, "fundo": "bg_ship.jpg",
   "entrada": {"tipo": "whip", "dur": 0.38},
   "camera": {"balanco": 0.55,
     "chaves": [{"t": 0, "zoom": 1.04, "fx": 0.56, "fy": 0.62},
                {"t": 11.6, "zoom": 1.42, "fx": 0.585, "fy": 0.62, "zoomv": 1.15, "corte": true}],
     "eventos": [{"tipo": "tremer", "t": 10.22, "amp": 22, "dur": 0.4}, {"tipo": "punch", "t": 10.22, "z": 0.12, "dur": 0.6},
                 {"tipo": "balanco_forte", "t0": 7.7, "t1": 10.5, "amp": 2.2}]},
   "sam": {"x": 1110, "chao": 962, "escala": 1.1, "figurino": "capitao", "pose": "idle", "expressao": "deadpan",
     "chaves": [{"t": 1.2, "pose": "maos_na_cintura", "expressao": "orgulhoso"},
                {"t": 5.6, "pose": "segurar_mapa", "prop": "mapa", "olharY": 1},
                {"t": 9.8, "propRot": 180}, {"t": 13.8, "olhar": -1, "expressao": "cetico"}],
     "acoes": [{"tipo": "susto", "t": 10.22, "altura": 50}, {"tipo": "soltar_mapa", "t": 10.22}]},
   "efeitos": [{"tipo": "simbolo", "txt": "!", "t0": 10.3, "t1": 11.2, "cor": "#e53935", "dx": 95, "dy": 520}]
 }],
 "eventos": [ {"tipo": "nome", "t0": 1.1, "t1": 4.1, "nome": "PEDRO ÁLVARES CABRAL", "sub": "Portuguese captain · played by Sam"} ],
 "legenda": [ {"palavras": [["That", 0.40], ["sailor", 0.56]], "fim": 2.9} ]
}
```
- Coordenadas do mundo: palco 1920×1080 (a pintura cobre o palco). `x`/`chao` = pés do Sam.
  `escala` 1.0 ≈ 470 px de altura (use 1.0–1.15 no plano aberto).
- Câmera: `zoom` ≥ 1, foco `fx`/`fy` em 0–1; `corte: true` = troca seca; sem corte = movimento
  até a chave (`ease: "inOut"` para suavizar). `fxv`/`fyv`/`zoomv` = enquadramento só do 9:16.
- Chaves do Sam (mudam a partir do tempo `t`): `pose`, `expressao`, `olhar` (−1 esquerda … 1 direita),
  `olharY` (1 = olha para baixo), `x`, `prop` ("mapa" | null), `propRot`, `fala` (boca mexe com a voz),
  `visivel`.
- Ações: `andar` {t0,t1,x0,x1}, `susto` {t,altura}, `sair` {t,xIni,xFim,dur}, `espiar` {t0,t1,lado,y},
  `piscar` {t}, `soltar_mapa` {t}. Qualquer ação aceita `ate` (para de valer depois desse tempo).
- Eventos de tela (gags/explicação): `nome`, `mapa` (rotas com `estilo` planejado/real, `navio`,
  rótulos, marcadores `bang`/`ponto`, `destaque` de continente), `cartao` (txt, pos, rot, icone, cor),
  `carimbo` (txt, sub, pos, rot), `calendario` (de, ate, tA, tB, mes, rodape), `review` (estrelas,
  frases, nome, sub, app), `placa` (txt, seta), `raios`. Todos aceitam `pv` = posição no 9:16.

## 5. Catálogo validado (nomes fixos — o studio avisa se usar outro) — v6.2
- **Poses (20):** idle, neutro, apontar, apontar_lado, apontar_esq, apontar_cima, dar_de_ombros,
  maos_ao_alto, susto, comemorar, rezar, reverencia, segurar_mapa, maos_na_cintura, reivindicar,
  acenar, segurar_lanca (objeto em pé na mão), erguer (braço direito para cima, ex.: espada), segurar
  (duas mãos à frente), assinar (mão no peito, ex.: pena).
- **Expressões (12):** deadpan (padrão), serio, neutro, falando, cetico, sorriso, orgulhoso, surpreso,
  assustado, feliz, olhos_fechados, irritado.

### 5.1 Guarda-roupa: 97 figurinos prontos
Use o nome em `"figurino"` (ex.: `"figurino": "legionario"`). Galeria: `galeria-figurinos.jpg` (todos numa
imagem), `galeria-1.jpg` … `galeria-4.jpg` (maiores) ou o botão "Ver galeria de figurinos no palco" no studio.
- **Sam e Brasil (19):** eua (abertura/voto), padrao, capitao (explorador/Cabral), tupi, colono, frances, nobre, garimpeiro, rei, imperador, uniforme_imperial (Pedro I), militar, pedro_ii, princesa, presidente, presidente_fedora, jogador, carnaval, turista.
- **Antiguidade (16):** homem_das_cavernas, farao, egipcio, rainha_egipcia, hoplita, espartano, filosofo, atleta_grego, alexandre, legionario, centuriao, senador, imperador_romano, gladiador, godo, gaules.
- **Idade Média (10):** viking, viking_mito (capacete com chifres = o mito; use com carimbo MYTH), cavaleiro, cruzado, joana_darc, rainha, campones, monge, bispo (santos e bispos: Nicolau, Patrício, Valentim), bobo_da_corte.
- **Ásia (11):** samurai, ninja, shogun, kimono, imperador_chines, mandarim, soldado_terracota, mongol, maraja, indiano, jogador_criquete.
- **Américas (13):** asteca (governante histórico, sem piada), conquistador, puritano, pai_fundador, casaca_vermelha, cowboy, xerife, pioneiro, soldado_mexicano, charro, revolucionario_mexicano, soldado_uniao, confederado.
- **Europa moderna (15):** guarda_real, rei_frances, maria_antonieta, revolucionario, napoleao, cavalheiro_vitoriano, dama_vitoriana, rainha_vitoria, czar, czar_sem_barba (Pedro, o Grande e o imposto da barba), russo, detetive, pirata, barba_negra, rainha_margherita.
- **Datas comemorativas (1):** papai_noel (com bispo para São Nicolau).
- **Século XX e hoje (12):** soldado_ww1, soldado_ww2, explorador_colonial, astronauta, cosmonauta, cientista, medico, chef, operario, formando, empresario, turista_americano.
- **Trocar de figurino no meio da cena:** chave `{"t": 8.0, "figurino": "pirata"}` (combine com o efeito
  `poeira` para a troca-relâmpago). A camisa `eua` só na abertura e no voto.

### 5.2 Objetos de cena (38)
- **Com as duas mãos** (use em `prop`, com pose `segurar` ou `segurar_mapa`): mapa, bateia, taca, livro, planta,
  pergaminho, globo, bau, presente, pizza.
- **Em pé na mão** (pose `segurar_lanca`): lanca, tridente, bandeira (cores com `propCores`, ex.:
  `["#006847", "#ffffff", "#ce1126"]`), tocha, mosquete, guarda_chuva, cajado.
- **Pendurados:** bengala, saco_dinheiro. **Escudos** (vão na mão esquerda): escudo, escudo_romano.
- **Na mão, ao longo do antebraço** (poses `erguer`, `apontar`, `segurar_lanca`…): espada, katana, cetro,
  machado, clava, pena, microfone, bola, lupa, telescopio, pao, xicara, laco, garrafa (genérica, sem
  marca), coracao, flores, trevo.
- **Chaves:** `prop` = mão direita (`"propMao": "L"` para a esquerda); `prop2` = 2º objeto, na mão
  esquerda (`"propMao2": "R"` para a direita; `prop2` só aceita objeto de uma mão); `propRot` gira o
  objeto de duas mãos (ex.: mapa de cabeça para baixo = 180); tirar: `"prop": null`.
  Ex.: `{"t": 12.0, "pose": "erguer", "prop": "espada", "prop2": "escudo"}`.

### 5.3 Figurino novo, montado por peças (sem mexer no código)
No `episode.json`, em `"figurinos"`, dê um nome e escolha as peças; depois use o nome em `"figurino"`:
```json
"figurinos": {
  "chaucer": {"tronco": {"tipo": "liso", "cor": "#5a2a6b"}, "frente": [{"tipo": "cinto"}],
              "chapeu": {"tipo": "touca", "cor": "#2b2b3a"}, "rosto": [{"tipo": "barba", "estilo": "cavanhaque"}]}
}
```
- `tronco` {tipo, cor, cor2, cor3, emblema, colunas}: liso, listras_h, listras_v, xadrez, colete, terno, uniforme, toga, armadura, cota_malha, tabardo, kimono, kaftan, pele, jaleco, macacao, sem_camisa, espacial, lantejoula, arlequim.
  (`uniforme`: `colunas` 1 ou 2 e `cor3` = gola; `tabardo`: `emblema` cruz, chevron ou leao.)
- `frente` (lista) {tipo, cor, cor2, cores}: gravata, gravata_borboleta, bandana, rufo, arminho, colar, perolas, faixa, medalha, estrela_xerife, dragonas, cinto_cruzado, cinto, botoes, cruz, peitoral, ombreiras, colar_egipcio, franjas, kamishimo, emblema_quadrado, estetoscopio, lenco_pescoco, gola_puritana, cartucheira, pele_branca, gola_alta.
- `baixo` {tipo, cor, cor2}: saia_curta, shendyt, kilt, vestido, manto_longo, hakama, short, saia_fibra.
- `costas` {tipo, cor, borda}: capa, capa_curta (`borda`: arminho, penas, ouro ou pele).
- `chapeu` {tipo, cor, cor2, estilo}: coroa, tiara, louros, elmo_romano, elmo_grego, elmo_viking, kabuto, nemes, turbante, mianguan, chapeu_qing, cowboy, sombrero, cartola, coco, tricorne, bicorne, quepe, shako, capacete_colonial, boina, fez, gorro_frigio, gorro_pele, ushanka, mongol, capacete_astronauta, chef, capelo, capacete_obra, bandana_pirata, elmo_cavaleiro, morion, touca, peruca_colonial, pele_urso, capacete_ww1, capacete_ww2, bone, fita, capuz_ninja, capuz_monge, bobo, eboshi, topi, deerstalker, gorro_noel, mitra, capotain, cocar_asteca, peruca_alta, chapeu_palha, chapeu_explorador, chapeu_garimpeiro, chapeu_pluma, fedora, cocar_tupi, cocar_carnaval.
  Estilos: coroa `fechada`/`pequena`; elmo_romano `legionario`/`centuriao`/`gladiador`; elmo_viking
  `chifres` (o mito); turbante `maraja`; tricorne `pirata`.
- `rosto` (lista) {tipo, cor, estilo}: barba, bigode, tapa_olho, oculos, oculos_sol, monoculo, cabelo. Barba: `cheia`, `curta`, `cavanhaque`
  (com `cor`) ou `longa` (sempre branca, estilo Pedro II). Bigode: `grande`, `fino`, `guidao`.
  Cabelo (`{"tipo": "cabelo", "estilo": …}`): longo, chanel, coque, rabo.
- `manga` (cor da manga ou `null` = braço de fora), `bota` (cor do calçado), `bracos`: `"preto"` (padrão) ou `"branco"`.
- O studio confere as peças e avisa (⚠) se algum nome não existir.

### 5.4 Respeito e efeitos sonoros
- **Regra de respeito:** o Sam não interpreta pessoas escravizadas nem vítimas de tragédias, e não usa
  trajes sagrados de povos indígenas como fantasia; nessas cenas a pintura fica sozinha (ou o Sam
  aparece sério como narrador), sem gag.
- **SFX:** whoosh, whoosh_leve, zip, bonk, pop, tick, ding, tink, blip, thud, clank, coro, grilos, passo.

## 6. Prompt das pinturas A5 SEM o Sam (colar em toda cena)
```text
Polished 2D cel-shaded historical cartoon illustration, clean thick black outlines, full-color
painterly [ERA/PLACE] scenery, warm golden sunlight, soft cel shading. [SCENE: place, props, time of
day, weather]. Keep the main landmark in the central third of the width. Leave empty, flat, open
ground in the lower middle of the image where a character will be added later. Background extras,
if any, are tiny simple cartoon figures far away. Wide 16:9 composition, horizon at about 60% of the
height. No main character, no people in the foreground, no text, no letters, no numbers, no logos,
no watermarks, no speech bubbles, no photorealism, no 3D CGI.
```
QC da pintura: sem texto, sem humano realista em primeiro plano, chão livre no terço inferior,
marco do lugar no terço central, paleta da era repetida no episódio.

## 7. Ritmo de humor e explicação (padrão v6)
- Algo muda na tela a cada **3–6 s** (pose, expressão, corte, cartão, efeito).
- **1 gag visual a cada 20–30 s** (carimbo, review, placa, espiada, saída correndo, "?" / "!").
- **1 explicação visual por fato-chave** (mapa/rota, calendário, número animado, nome do personagem).
- Piada nunca inventa fato; em cena séria (escravidão, guerra, morte) **sem gag**: Sam sério, câmera
  lenta, sem SFX cômico.
- Final de todo episódio: o Sam olha para a câmera (deadpan) + voto de 3 opções.

## 8. Próximas melhorias do studio (v6.3+)
- Figurante animado (2º boneco com figurino) para diálogos e cabo de guerra.
- Mapa com mais regiões (Europa detalhada, Ásia oriental, EUA por estados).
- Mais cabelos e rostos (tranças, careca, perucas coloridas) quando um episódio pedir.
