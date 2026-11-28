# Sam Studio v7 — Sam 3D, corpo humano e saúde (só 9:16, 61 a 90 s)

**Abrir o estúdio:** https://wemmersonferreira925-cpu.github.io/estudio-sam/v7/  
**Carregador para a prévia do Grok:** [`grok.html`](grok.html) (o Grok troca só o roteiro dentro dele) · exemplo pronto: https://wemmersonferreira925-cpu.github.io/estudio-sam/v7/grok-exemplo.html

## O que mudou
- **Sam em 3D de verdade (estilo A):** o mesmo rosto e as mesmas expressões do Sam 2D, agora com volume, contorno de desenho e brilho de borda. Ganhou cara e poses de sarcasmo: `sarcastico`, `revirando`, `julgando`, `sarcasmo`, `bracos_cruzados`, `explicar`.
- **Cenários 3D animados:** `estudio` (telão + hélice de DNA girando) e `arteria` (hemácias passando, o Sam surfando numa hemácia).
- **Cartões de saúde:** risco (`alerta`), cuidado (`cuidado`), fato com fonte (`fato`), contador gigante (`numero`), lista que vai marcando (`lista`), rótulo com seta que segue a célula (`rotulo`), carimbo colorido e aviso "not medical advice".
- **Roteiro sem tempos:** o Grok escreve as falas e o que aparece, preso a palavras da fala. O estúdio calcula os tempos sozinho.
- **Narração alinhada sozinha:** carregue o MP3 de qualquer gerador de voz. O estúdio acha as pausas e encaixa cada palavra (no teste: erro de até 0,02 s por bloco).
- **Efeitos sonoros automáticos**, gerados pelo próprio estúdio (whoosh, pop, carimbo, alerta, ding, coração…). Áudio final em −14 LUFS.
- **Exporta MP4 quadro a quadro:** não pula quadro, mesmo em PC fraco. No Chrome/Edge do computador sai H.264 + AAC.

## Montar o projeto no Grok (uma vez só)
1. Em grok.com, crie um **Projeto** chamado "Sam Studio".
2. Cole o texto de `grok/GROK-INSTRUCOES.txt` nas instruções do projeto.
3. Anexe ao projeto: `grok/FORMATO-ROTEIRO-v7.md`, `grok/exemplo-roteiro.json`, `grok/grok.html` e `grok/sam-ficha-referencia.jpg`.

## Fazer um episódio
1. No projeto, peça: *"Episode: what happens to your body if you drink only soda for 30 days"*.
2. O Grok devolve: fontes, o roteiro (JSON), o **grok.html já com o roteiro**, a narração em texto, prompts de clipe e a legenda do post.
3. Clique em **Preview** no bloco html: o estúdio abre dentro do Grok com o episódio (sem voz, os tempos são estimados).
4. Gere a voz com o texto do item "NARRAÇÃO" (ElevenLabs, voiceover do vidIQ ou outro) e baixe o MP3.
5. No estúdio: **passo 2** (narração) → tudo se alinha à voz. **Passo 3** se o roteiro pedir clipes. **Passo 4** tem de mostrar zero ⚠. **Passo 5** → Exportar MP4.
6. Se a prévia do Grok não baixar o arquivo, use **"abrir este roteiro no estúdio em uma aba"** e exporte de lá. Também dá para colar o JSON direto no estúdio, no passo 1.

## Clipes do Grok Imagine / Flow
- Use para o que o estúdio não desenha: dentro do estômago, neurônios disparando, um vírus entrando na célula, a comida descendo.
- No roteiro: `"cena": { "video": "clip_estomago.mp4" }` (tela cheia) ou `"cena": { "cenario": "estudio", "tela": "clip_estomago.mp4" }` (no telão, com o Sam apresentando ao lado).
- Para o Sam aparecer igual no clipe, anexe `sam-ficha-referencia.jpg` como referência. Mesmo assim, prefira clipes **sem** o Sam: ele fica perfeito no estúdio.
- Baixe o clipe com **o mesmo nome** que está no roteiro e carregue no passo 3.

## Regras que protegem o canal
- Cada número de saúde precisa de fonte (CDC, NIH, NHS, WHO, Mayo Clinic). O Grok coloca a fonte no cartão.
- Nada de cura, dose, dieta extrema ou conselho individual. O aviso "For education only — not medical advice" já entra no vídeo. Repita na descrição.
- No YouTube, marque "conteúdo alterado ou sintético" quando usar clipe realista do Grok Imagine/Flow. O público é **adulto/geral**, não "feito para crianças".
- O humor zomba dos **hábitos**, nunca de quem está doente, do peso ou da aparência.

## Arquivos desta pasta
- `index.html` — o estúdio completo (um arquivo só; abre no Chrome).
- `grok.html` — carregador pequeno para a prévia do Grok (puxa o estúdio deste site).
- `grok-exemplo.html` — o carregador já com o roteiro da demo.
- `grok/` — tudo para o projeto do Grok (instruções, formato do roteiro, exemplo e fichas do Sam).
- `referencias/` — fichas do Sam 3D para o Grok Imagine e o Flow.
- `codigo/` — fonte do estúdio v7 (o motor da v6 não foi alterado; a v7 é uma pasta nova).
