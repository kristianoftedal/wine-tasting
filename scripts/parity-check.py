"""Parity check: do the int8 ONNX graphs reproduce the PyTorch originals?

Not run automatically. Needs a Python environment with torch, transformers and
pylate (e.g. `uv venv .venv && uv pip install torch transformers pylate numpy`)
and downloads the original checkpoints (ltg/norbert3-base ~500 MB,
lightonai/mLateOn ~1.2 GB) on first use.

  1. npx tsx scripts/parity-dump.ts /tmp/parity-dump.json      # Node: ids + ONNX vectors
  2. python scripts/parity-check.py /tmp/parity-dump.json      # here: PyTorch on the same ids

Reads token ids + per-token vectors dumped by Node (parity-dump.json), runs the
original PyTorch models on the same ids and reports per-token cosine. Mean
cosine > 0.99 is the pass condition used in the plan (int8 quantisation costs
a little; a wrong export costs a lot).
"""
import json, sys, numpy as np, torch
dump = json.load(open(sys.argv[1]))

def cos(a, b):
    a = np.asarray(a, dtype=np.float32); b = np.asarray(b, dtype=np.float32)
    return float((a @ b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

# ── NorBERT3 (custom code; last hidden state) ──
from transformers import AutoModel
norbert = AutoModel.from_pretrained('ltg/norbert3-base', trust_remote_code=True).to('cpu').eval()
sims = []
for note in dump['bert']:
    ids = torch.tensor([note['ids']])
    with torch.no_grad():
        out = norbert(input_ids=ids, attention_mask=torch.ones_like(ids))
    hs = out.last_hidden_state[0].numpy()
    for t, vec in enumerate(note['vectors']):
        sims.append(cos(vec, hs[t]))
print(f"bert: {len(sims)} tokens, mean cos {np.mean(sims):.4f}, min {np.min(sims):.4f}")

# ── mLateOn via PyLate (projection + normalisation included) ──
from pylate import models
colbert = models.ColBERT(model_name_or_path='lightonai/mLateOn', device='cpu')
sims = []
st = colbert[0].auto_model.to('cpu').eval()
dense = [colbert[i].to('cpu') for i in range(1, len(colbert))]
for note in dump['colbert']:
    ids = torch.tensor([note['ids']])
    with torch.no_grad():
        feats = {'input_ids': ids, 'attention_mask': torch.ones_like(ids)}
        hs = st(**feats).last_hidden_state
        x = {'token_embeddings': hs, 'attention_mask': feats['attention_mask']}
        for d in dense:
            x = d(x)
        emb = torch.nn.functional.normalize(x['token_embeddings'][0], dim=-1).numpy()
    for t, vec in enumerate(note['vectors']):
        sims.append(cos(vec, emb[t]))
print(f"colbert: {len(sims)} tokens, mean cos {np.mean(sims):.4f}, min {np.min(sims):.4f}")
