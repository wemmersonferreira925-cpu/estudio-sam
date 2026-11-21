"""Sam Studio v6 — alinhamento do roteiro com a narração (offline, PocketSphinx) + blocos de legenda.

Uso:  python3 alinhar.py narracao.wav roteiro.txt saida.json [--inicio 0.0]

roteiro.txt = exatamente o texto narrado (inglês). Quando a TELA deve mostrar algo diferente
do que é FALADO, escreva [exibido|falado]:   In April of [1500,|fifteen hundred,] his fleet...
Palavras fora do dicionário (nomes) também usam esse formato com uma grafia fonética:
[Álvares|al vah rays]  [Tiradentes|tee rah den tees]
Saída: {"palavras": [[texto, inicio, fim], ...], "legenda": [{"palavras": [[texto, inicio], ...], "fim": s}, ...]}
Regras da legenda (fixas do canal): blocos de até 6 palavras, SEMPRE cortados no fim da frase.
"""
import json, re, subprocess, sys, wave, math

def tokens(text):
    out = []
    for m in re.finditer(r'\[([^|\]]+)\|([^\]]+)\]|(\S+)', text):
        if m.group(3): disp, spoken = m.group(3), m.group(3)
        else: disp, spoken = m.group(1).strip(), m.group(2).strip()
        sp = [re.sub(r"[^a-z']", '', w.lower()) for w in spoken.split()]
        sp = [w.strip("'") for w in sp if w.strip("'")]
        out.append({'disp': disp, 'spoken': sp})
    return out

def align(wav, toks):
    from pocketsphinx import Decoder
    d = Decoder(samprate=16000, bestpath=False, loglevel='ERROR')
    words = [w for t in toks for w in t['spoken']]
    unknown = sorted({w for w in words if d.lookup_word(w) is None})
    if unknown:
        raise SystemExit('Palavras fora do dicionário (use [Exibido|grafia fonética]): ' + ', '.join(unknown))
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, check=True).stdout
    d.set_align_text(' '.join(words))
    d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
    seg = [(re.sub(r'\(\d+\)$', '', s.word), s.start_frame / 100, s.end_frame / 100) for s in d.seg()]
    seg = [s for s in seg if not s[0].startswith('<') and s[0] != '(NULL)']
    if len(seg) != len(words):
        raise SystemExit(f'Alinhamento incompleto ({len(seg)} de {len(words)} palavras). Confira se o roteiro é exatamente o narrado.')
    i = 0
    for t in toks:
        n = len(t['spoken']); t['t0'] = seg[i][1]; t['t1'] = seg[i + n - 1][2]; i += n
    return toks

def blocks(toks):
    sentences, cur = [], []
    for t in toks:
        cur.append(t)
        if re.search(r'([.!?]["”’)]*|\.\.\.)$', t['disp']): sentences.append(cur); cur = []
    if cur: sentences.append(cur)
    out = []
    for s in sentences:
        n = len(s); k = math.ceil(n / 6); start = 0
        for j in range(k):
            remaining = n - start; left = k - j
            size = math.ceil(remaining / left)
            end = start + size
            # prefere quebrar depois de vírgula/dois-pontos dentro de ±1 palavra
            for cand in (end, end - 1, end + 1):
                if start < cand < n and cand - start <= 6 and re.search(r'[,:;]$', s[cand - 1]['disp']): end = cand; break
            end = min(end, start + 6, n)
            if j == k - 1: end = n
            blk = s[start:end]; start = end
            out.append({'palavras': [[b['disp'], round(b['t0'], 3)] for b in blk], 'fim': round(blk[-1]['t1'] + 0.25, 3)})
    return out

if __name__ == '__main__':
    wav, roteiro, saida = sys.argv[1:4]
    off = float(sys.argv[sys.argv.index('--inicio') + 1]) if '--inicio' in sys.argv else 0.0
    toks = align(wav, tokens(open(roteiro, encoding='utf-8').read()))
    for t in toks: t['t0'] += off; t['t1'] += off
    res = {'palavras': [[t['disp'], round(t['t0'], 3), round(t['t1'], 3)] for t in toks], 'legenda': blocks(toks)}
    json.dump(res, open(saida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"{len(res['palavras'])} palavras, {len(res['legenda'])} blocos de legenda -> {saida}")
    for b in res['legenda']: print(f"{b['palavras'][0][1]:7.2f}  " + ' '.join(w[0] for w in b['palavras']))
