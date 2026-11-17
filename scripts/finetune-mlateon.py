#!/usr/bin/env python3
"""
Fine-tune mLateOn (ColBERT) on this app's notes, listwise per reference note.

Data: scripts/validation-results/finetune/{train,val}.jsonl from
scripts/build-colbert-pairs.ts. Each row is one Vinmonopolet reference note
with up to five candidate taster notes and two teachers per pair: `teacher`
(the calibrated LLM rater, 0-4) and `ladder` (the production ladder, 0-100).

The loss is the score's own question, not retrieval's: for one reference
note, the distribution over its candidate notes of ColBERT's MaxSim must
match the teacher's distribution (KL, listwise). ColBERT's pretraining asks
the transposed question — for one query, which document — and measured on
the frozen set that ranking carries nothing about the human ratings once the
ladder is known (15 Nov 2026, partial rho 0.00).

MaxSim is ColBERT's own: full notes, every token, "[Q] " / "[D] " prefixes,
L2-normalised token vectors, sum over query tokens of the best document
token, divided by the query length so notes of different lengths compare.

  python scripts/finetune-mlateon.py --teacher=teacher --out=models/lightonai/mLateOn-ft
  python scripts/finetune-mlateon.py --teacher=ladder  --out=models/lightonai/mLateOn-ladder
  python scripts/finetune-mlateon.py --score=<pairs.json> --model=<dir|hub id> --out=<scores.json>
  python scripts/finetune-mlateon.py --table=src/lib/softEngines/colbert-table.generated.json --model=<dir> --out=<table.json>

--padded-penalty=N: a note padded with wrong words is graded at most N below
the same note unpadded. The LLM teacher lowered its rating for only 14 of 60
padded notes (16 Nov 2026) and a model trained on it paid wrong guesses in 41
of 220 frozen fields; a rubric line asking it to be strict made it agree
less with the human (0.573 -> 0.496) and still lowered only 15 of 60. The
rubric says one or two misses cost a level ("3 = stort sett støttet, én
mindre bom"), and the app's objective says a wrong guess never pays, so the
target enforces it rather than the teacher.

--isolated trains the way the table engine scores: every content word (the
`words` field build-colbert-pairs.ts writes) encoded alone as "[Q] word" or
"[D] word", mean-pooled, and the note score is the mean over the taster's
words of the best cosine against the reference's words. Trained on whole
notes, the fine-tune's gain did not survive conversion to a table (partial
rho 0.138 -> 0.033, 16 Nov 2026), and only a table deploys.

--table encodes every word of an existing table's vocabulary alone, as
"[Q] word" and "[D] word", mean-pooled over the word's own tokens and
L2-normalised: the format colbert-table reads, so a fine-tuned checkpoint can
ship the same way the production table does (no model at runtime).

Needs: pip install pylate torch  (Python 3.10+; runs on Apple MPS, CUDA or CPU).
"""
import argparse, json, math, random, time
import torch
import torch.nn.functional as F
from pylate import models

p = argparse.ArgumentParser()
p.add_argument('--data', default='scripts/validation-results/finetune')
p.add_argument('--model', default='lightonai/mLateOn')
p.add_argument('--teacher', choices=['teacher', 'ladder'], default='teacher')
p.add_argument('--out', default='models/lightonai/mLateOn-ft')
p.add_argument('--epochs', type=int, default=2)
p.add_argument('--lr', type=float, default=1e-5)
p.add_argument('--batch', type=int, default=8, help='reference notes per step')
p.add_argument('--student-temp', type=float, default=0.05, help='MaxSim / temp before the softmax')
p.add_argument('--teacher-temp', type=float, default=1.0, help='rating (0-4) / temp before the softmax')
p.add_argument('--score', help='score a pairs file instead of training: [{"id","user","reference"}]')
p.add_argument('--seed', type=int, default=20261115)
p.add_argument('--suffix', default='', help='data file suffix: train<suffix>.jsonl, val<suffix>.jsonl')
p.add_argument('--padded-penalty', type=float, default=0.0)
p.add_argument('--freeze-embeddings', action='store_true', help='freeze the token embedding matrix (256k x 768, ~200M of the 312M parameters); needed for --isolated on a 48 GB Mac')
p.add_argument('--isolated', action='store_true', help='train and validate word by word, as the table engine scores')
p.add_argument('--table', help='encode this table file\'s vocabulary word by word and write a table')
args = p.parse_args()

device = 'mps' if torch.backends.mps.is_available() else 'cuda' if torch.cuda.is_available() else 'cpu'
torch.manual_seed(args.seed); random.seed(args.seed)
model = models.ColBERT(model_name_or_path=args.model, device=device)


def encode(texts, is_query):
    f = model.tokenize(texts, is_query=is_query)
    f = {k: v.to(device) for k, v in f.items()}
    emb = F.normalize(model(f)['token_embeddings'], dim=-1)
    return emb, f['attention_mask'].bool()


def encode_words(words, is_query):
    """One pooled, L2-normalised vector per word, each encoded alone (as --table writes them)."""
    f = model.tokenize(words, is_query=is_query)
    f = {k: v.to(device) for k, v in f.items()}
    emb = F.normalize(model(f)['token_embeddings'], dim=-1)
    m = f['attention_mask'].clone().float()
    m[:, :2] = 0
    lengths = f['attention_mask'].sum(1)
    m[torch.arange(len(words)), lengths - 1] = 0
    # A word that tokenizes to nothing but specials would pool to the zero
    # vector, whose normalisation has a NaN gradient (it poisoned every
    # parameter after 14 steps); such a word falls back to all its tokens.
    empty = m.sum(1) == 0
    m[empty] = f['attention_mask'][empty].float()
    return F.normalize((emb * m[..., None]).sum(1) / m.sum(1, keepdim=True).clamp(min=1), dim=-1)


def word_maxsim(qwords, dwords, qv, dv):
    """Mean over the taster's words of the best cosine against the reference's words."""
    q = torch.stack([qv[w] for w in qwords]); d = torch.stack([dv[w] for w in dwords])
    return (q @ d.T).max(dim=1).values.mean()


def maxsim(q, qm, d, dm):
    """q: (Nq, Lq, D), d: (Nd, Ld, D) -> (Nq, Nd) mean-over-query-tokens MaxSim."""
    sim = torch.einsum('qid,njd->qnij', q, d)
    sim = sim.masked_fill(~dm[None, :, None, :], -1e4)
    best = sim.max(dim=-1).values  # (Nq, Nd, Lq)
    best = best * qm[:, None, :]
    return best.sum(-1) / qm.sum(-1, keepdim=True)


def target(qr):
    v = qr[args.teacher]
    if v is None:
        return None
    return v / 25.0 if args.teacher == 'ladder' else float(v)  # both on 0-4


def load(name):
    with open(f'{args.data}/{name}{args.suffix}.jsonl') as fh:
        rows = [json.loads(l) for l in fh if l.strip()]
    for r in rows:
        r['queries'] = [q for q in r['queries'] if target(q) is not None]
        right = next((target(q) for q in r['queries'] if q.get('level') == 4 and q['source'] == 'own'), None)
        for q in r['queries']:
            q['_target'] = target(q)
            if args.padded_penalty and q['source'] == 'padded' and right is not None:
                q['_target'] = min(q['_target'], right - args.padded_penalty)
    if args.isolated:
        for r in rows:
            r['queries'] = [q for q in r['queries'] if q.get('words')]
        rows = [r for r in rows if r.get('words')]
    return [r for r in rows if len(r['queries']) >= 3]


def spearman(x, y):
    def ranks(a):
        o = sorted(range(len(a)), key=lambda i: a[i]); rk = [0.0] * len(a); i = 0
        while i < len(o):
            j = i
            while j + 1 < len(o) and a[o[j + 1]] == a[o[i]]: j += 1
            for k in range(i, j + 1): rk[o[k]] = (i + j) / 2
            i = j + 1
        return rk
    rx, ry = ranks(x), ranks(y); mx, my = sum(rx) / len(rx), sum(ry) / len(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else 0.0


@torch.no_grad()
def evaluate(rows):
    """Pooled Spearman of score vs the LLM teacher and vs the ladder, over every (note, reference) pair."""
    model.eval()
    s, t, l = [], [], []
    for r in rows:
        if args.isolated:
            qw = sorted({w for x in r['queries'] for w in x['words']})
            qv = dict(zip(qw, encode_words(qw, True))); dv = dict(zip(r['words'], encode_words(r['words'], False)))
            sc = [word_maxsim(x['words'], r['words'], qv, dv).item() for x in r['queries']]
        else:
            d, dm = encode([r['text']], False)
            q, qm = encode([x['text'] for x in r['queries']], True)
            sc = maxsim(q, qm, d, dm)[:, 0].tolist()
        for x, v in zip(r['queries'], sc):
            if x['teacher'] is not None:
                s.append(v); t.append(x['teacher']); l.append(x['ladder'])
    model.train()
    return spearman(s, t), spearman(s, l)


if args.score:
    pairs = json.load(open(args.score))
    model.eval(); out = {}
    with torch.no_grad():
        for i, pr in enumerate(pairs):
            d, dm = encode([pr['reference']], False)
            q, qm = encode([pr['user']], True)
            out[pr['id']] = maxsim(q, qm, d, dm)[0, 0].item()
            if i % 200 == 0: print(f'  scored {i}/{len(pairs)}', flush=True)
    json.dump(out, open(args.out, 'w'))
    print(f'wrote {len(out)} scores to {args.out}')
    raise SystemExit

if args.table:
    import base64
    vocab = list(json.load(open(args.table))['words'].keys())
    model.eval(); words = {}
    with torch.no_grad():
        for i in range(0, len(vocab), 64):
            chunk = vocab[i:i + 64]; enc = {}
            for side, is_q in (('q', True), ('d', False)):
                f = model.tokenize(chunk, is_query=is_q)
                f = {k: v.to(device) for k, v in f.items()}
                emb = F.normalize(model(f)['token_embeddings'], dim=-1)
                m = f['attention_mask'].clone()
                m[:, :2] = 0  # <bos>, [Q]/[D] prefix
                lengths = f['attention_mask'].sum(1)
                m[torch.arange(len(chunk)), lengths - 1] = 0  # <eos>
                pooled = F.normalize((emb * m[..., None]).sum(1) / m.sum(1, keepdim=True).clamp(min=1), dim=-1)
                enc[side] = pooled.float().cpu().numpy()
            for j, w in enumerate(chunk):
                words[w] = {'q': base64.b64encode(enc['q'][j].astype('float32').tobytes()).decode(), 'd': base64.b64encode(enc['d'][j].astype('float32').tobytes()).decode()}
    json.dump({'meta': {'model': f'{args.model} (isolated words)', 'dimensions': 128, 'words': len(words)}, 'words': words}, open(args.out, 'w'))
    print(f'wrote {len(words)} words to {args.out}')
    raise SystemExit

train, val = load('train'), load('val')
print(f'{device}: train {len(train)} reference notes, val {len(val)}; teacher = {args.teacher}')
rho_t, rho_l = evaluate(val)
print(f'epoch 0  val rho(score, LLM teacher) {rho_t:.3f}  rho(score, ladder) {rho_l:.3f}')

if args.freeze_embeddings:
    for name, prm in model.named_parameters():
        if 'embeddings.tok_embeddings' in name or name.endswith('embeddings.weight'):
            prm.requires_grad = False
    print(f'trainable parameters: {sum(x.numel() for x in model.parameters() if x.requires_grad) / 1e6:.0f}M')
opt = torch.optim.AdamW([x for x in model.parameters() if x.requires_grad], lr=args.lr, weight_decay=0.01)
steps = args.epochs * math.ceil(len(train) / args.batch)
sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / max(1, int(0.05 * steps))) * max(0.0, (steps - s) / steps))
model.train()
for epoch in range(1, args.epochs + 1):
    random.shuffle(train); t0 = time.time(); total = 0.0
    for b in range(0, len(train), args.batch):
        batch = train[b:b + args.batch]
        if args.isolated:
            qw = sorted({w for r in batch for x in r['queries'] for w in x['words']})
            dw = sorted({w for r in batch for w in r['words']})
            qv = dict(zip(qw, encode_words(qw, True))); dv = dict(zip(dw, encode_words(dw, False)))
        else:
            d, dm = encode([r['text'] for r in batch], False)
            q, qm = encode([x['text'] for r in batch for x in r['queries']], True)
        loss, i = 0.0, 0
        for j, r in enumerate(batch):
            n = len(r['queries'])
            if args.isolated:
                s = torch.stack([word_maxsim(x['words'], r['words'], qv, dv) for x in r['queries']])
            else:
                s = maxsim(q[i:i + n], qm[i:i + n], d[j:j + 1], dm[j:j + 1])[:, 0]
            t = torch.tensor([x['_target'] for x in r['queries']], device=device)
            loss = loss + F.kl_div(F.log_softmax(s / args.student_temp, 0), F.softmax(t / args.teacher_temp, 0), reduction='sum')
            i += n
        loss = loss / len(batch)
        opt.zero_grad(); loss.backward()
        # foreach=False and reading the norm back: on MPS the fused clip ran
        # ahead of the backward pass in word-by-word mode and wrote NaN into
        # every parameter after ~14 steps; forcing the sync removed it.
        gn = torch.nn.utils.clip_grad_norm_([x for x in model.parameters() if x.requires_grad], 1.0, foreach=False)
        if not math.isfinite(gn.item()):
            print(f'  skipped step {b // args.batch}: gradient norm {gn.item()}', flush=True); continue
        opt.step(); sched.step()
        if device == 'mps':
            # word-by-word batches vary in shape and fragment the pool; emptying it
            # without a synchronise first corrupted parameters (NaN after 14 steps)
            torch.mps.synchronize(); torch.mps.empty_cache()
        total += loss.item()
        if (b // args.batch) % 25 == 0:
            print(f'  epoch {epoch} step {b // args.batch}/{math.ceil(len(train) / args.batch)} loss {loss.item():.4f}', flush=True)
    rho_t, rho_l = evaluate(val)
    print(f'epoch {epoch}  mean loss {total / math.ceil(len(train) / args.batch):.4f}  val rho(score, LLM teacher) {rho_t:.3f}  rho(score, ladder) {rho_l:.3f}  ({time.time() - t0:.0f}s)', flush=True)

model.save(args.out)
print(f'saved {args.out}')
