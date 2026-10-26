// §37.26 [ASSUMED] Compact presentation of human wire views and the public knowledge catalogue only.
const clean = s => String(s ?? '').replace(/<@[^>]*>|<\/>/g, '').replace(/\s+/g, ' ').trim();
const short = (s, n = 110) => { const t = clean(s); return t.length > n ? `${t.slice(0, n)}…` : t; };
const json = x => JSON.stringify(x);
const progress = p => p ? `${p.current}/${p.total}` : '';
export const actionList = o => o.digest.actions.map(a => `${a.id}: ${a.text} ${json(a.intent)}`).join('\n') + '\n';

export function observationMarkdown(o, pack, n) {
  const d = o.digest, c = o.context, own = o.private;
  const catalogue = new Map(['operators', 'items', 'bonds', 'bands'].flatMap(k => pack?.[k] || []).map(r => [r.id, r]));
  const name = id => catalogue.get(id)?.name || id || '—';
  const bonds = ids => (ids || []).map(name).join('/');
  const held = [...d.bench, ...d.overflow, ...d.board];
  const lines = [`# Observation ${n} · seat ${own.seat} · R${c.round} ${c.kind} / ${c.phase}`,
    `LP ${d.lp}; funds ${d.economy.gold}; 调度中心 ${d.economy.level}/${own.shop.maxLevel}, upgrade ${d.economy.upgradePrice}; refresh ${d.economy.refreshPrice} (free ${own.shop.freeRefreshes}); deploy ${own.deployCount}/${d.deployCap}.`,
    `Budget: ${c.deadline === 0 ? 'untimed solo' : `${Math.max(0, c.deadline - o.public.serverNow)} ms at receipt`}; ${c.remaining} intents left across this decision.`,
    `Funds ${d.economy.interest.carries ? `carry; interest ${d.economy.interest.now}, next at ${d.economy.interest.nextGold ?? '—'}` : 'expire at prep end'}; frozen slots ${d.economy.frozenSlots.join(',') || 'none'}.`,
    `Band: ${d.band.name || '—'} (${d.band.id || 'none'}). ${short(catalogue.get(d.band.id)?.effect, 180)}`];
  for (const e of own.effects || []) lines.push(`Effect ${e.name}: ${short(e.desc)} ${e.counter != null ? `counter=${e.counter}` : ''} ${e.counterText || ''} ${progress(e.progress)} ${e.roundProgress ? `round ${progress(e.roundProgress)}` : ''}`.trim());
  lines.push(`Counters: spent ${own.stats.gold}, refreshes ${own.stats.refreshes}, merges ${own.stats.merges}.`);
  lines.push('\n## Last response / host feedback');
  lines.push(...(o.results?.length ? o.results.map(r => `${r.ok ? 'ACCEPTED' : 'REJECTED'} ${json(r.intent)}: ${r.error || 'ok'}${r.detail ? ` (${clean(r.detail)})` : ''}${r.fallback ? ' — FALLBACK' : ''}`) : ['None.']));
  lines.push('\n## Shop');
  for (const s of d.shop.filter(Boolean)) {
    const inventory = [...held, ...held.flatMap(p => (p.items || []).map(i => ({ ...i, kind: 'item' })))];
    const copies = inventory.filter(p => p.kind === s.kind && (p.baseId || p.id) === (s.baseId || s.id));
    lines.push(`${s.slot}: ${s.name} T${s.tier} $${s.price} ${s.sold ? 'SOLD' : ''}${s.frozen ? ' FROZEN' : ''}; ${bonds(s.bonds)}; owned ${copies.filter(p => !p.golden).length} normal + ${copies.filter(p => p.golden).length} elite${s.kind === 'item' ? `; ${short(catalogue.get(s.id)?.effect)}` : ''}`);
  }
  for (const [label, pieces] of [['Hand', d.bench], ['Temp', d.overflow], ['Board', d.board]]) {
    lines.push(`\n## ${label}`);
    lines.push(...(pieces.length ? pieces.map(p => `uid=${p.uid} ${p.name}${p.golden ? ' ELITE' : ''} ${p.row != null ? `@${p.row},${p.col} ${p.dir}` : p.slot != null ? `slot=${p.slot}` : ''}; ${bonds(p.bonds)}${p.items?.length ? `; items ${p.items.map(i => `${i.uid}:${i.name}${i.progress ? ` ${progress(i.progress)}` : ''}`).join(', ')}` : ''}${p.kind === 'item' ? `; ${short(catalogue.get(p.id)?.effect)} ${progress(p.progress)}` : ''}`) : ['Empty.']));
  }
  lines.push('\n## Bonds (banked layers; counts are current, hand is potential unless countsHand)');
  const entries = new Map(d.bonds.map(b => [b.bondId, b]));
  for (const p of held) for (const id of p.bonds || []) if (!entries.has(id)) entries.set(id, { bondId: id, count: 0, layers: 0, thresholds: catalogue.get(id)?.thresholds });
  for (const b of entries.values()) {
    const rec = catalogue.get(b.bondId), thresholds = b.thresholds || [], next = thresholds.find(t => t > b.count);
    const effectLines = (rec?.effect || '').split('\n');
    const effect = next ? effectLines.find(l => new RegExp(`<[^>]*?${next}(?:名|个|[^0-9])`).test(l)) || effectLines[0] : effectLines[0];
    lines.push(`${name(b.bondId)}: ${b.count} / [${thresholds.join(',')}] L=${b.layers}; ${b.off ? 'DISABLED' : b.active ? 'active' : 'inactive'}${b.countsHand ? ' (counts hand)' : ''}; next ${next ?? 'max'}: ${short(effect, 100)}`);
  }
  lines.push('\n## Next wave (public gate/route preview)');
  const waves = new Map();
  for (const e of d.upcoming) {
    const key = `${e.name} | ${e.gate} | ${e.fly ? 'FLY' : 'ground'}${e.boss ? ' BOSS' : ''}${e.source === 'bounty' ? ' bounty' : ''}`;
    waves.set(key, (waves.get(key) || 0) + e.count);
  }
  lines.push(...(waves.size ? [...waves].map(([k, count]) => `${k}: ×${count}`) : ['None.']));
  if (o.public.bossHp) lines.push(`Leader pool ${o.public.bossHp.hp}/${o.public.bossHp.max}`);
  lines.push('\n## Pending choices');
  for (const a of d.actions.filter(a => a.intent.t === 'g.band')) lines.push(`${a.id} band ${a.intent.bandId}: ${name(a.intent.bandId)} — ${short(catalogue.get(a.intent.bandId)?.effect)}`);
  for (const a of d.actions.filter(a => a.intent.t === 'g.choice')) {
    const card = a.intent.choiceId ? d.personalChoice?.cards[a.intent.idx] : d.choices.cards?.find(x => x.idx === a.intent.idx);
    lines.push(`${a.id} card ${a.intent.choiceId || 'common'} idx=${a.intent.idx} ${card?.id || card?.effectId || ''}: ${card?.name || ''} — ${short(card?.desc)}`);
  }
  for (const w of d.choices.offers || []) for (const s of w.seats.filter(s => s.playerId === d.playerId && !s.picked)) for (const card of s.slots.filter(c => c.available)) {
    lines.push(`offer ${w.id} seq=${w.seq} idx=${card.idx} id=${card.id}: ${card.name} $${card.price ?? 0} — ${short(card.desc)}`);
  }
  for (const r of d.rewards.filter(r => r && !r.sold)) lines.push(`reward idx=${r.slot} id=${r.id}: ${r.name} $${r.price ?? 0} — ${short(catalogue.get(r.id)?.effect || catalogue.get(r.id)?.traits?.join('; '))}`);
  if (d.opponents.length) {
    lines.push('\n## Teammates (public)');
    for (const p of d.opponents) lines.push(`${p.playerId} LP=${p.lp}, band=${name(p.bandId)}; ${p.bonds.filter(b => b.active).map(b => `${name(b.bondId)} ${b.count} L${b.layers}`).join('; ')}; board ${p.board.map(u => `${u.name}@${u.row},${u.col}`).join(', ')}`);
  }
  lines.push('\n## Actions (IDs expire at the next observation)');
  // Placement is often thousands of actions. Group consecutive direction IDs at the same tile without losing the mapping.
  const moves = new Map();
  for (const a of d.actions) {
    if (a.intent.t === 'g.move' && a.intent.to.area === 'board') {
      const i = a.intent, key = `${i.uid}@${i.to.row},${i.to.col}`;
      if (!moves.has(key)) moves.set(key, []);
      moves.get(key).push(`${a.id}=${i.dir}`);
    } else lines.push(`${a.id}: ${a.text}`);
  }
  for (const [key, ids] of moves) lines.push(`place ${key}: ${ids.join(' ')}`);
  lines.push(`\nAnswer act-${n}.json: ["a1"] or [{"t":"g.buy","slot":0}]. Prep {"done":true} submits Ready through the validator. Raw intents support swaps/Arts; see obs-${n}.json actions and geometry.`);
  // [ASSUMED] ~3–4k-token target: 9000 characters, with full lossless actions/request beside the compact page.
  // Keep header, feedback and all state ahead of the potentially huge placement list.
  const footer = `\nFull actions: obs-${n}.actions.md; raw digest: obs-${n}.json; full request: obs-${n}.request.json.\n`;
  let out = '';
  for (const line of lines) {
    if (out.length + line.length > 8800) { out += '\n[More detail in the raw digest and full action list.]\n'; break; }
    out += `${line}\n`;
  }
  return out + footer;
}

export function resultMarkdown(record, seat, names = {}) {
  const p = record.summary.players.find(p => p.seat === seat), trace = record.layerTrace;
  const spent = {};
  for (const s of trace.spending.filter(s => s.pid === p.playerId)) {
    const kind = s.name === 'buy' ? `buy:${s.kind}` : s.name;
    spent[kind] = (spent[kind] || 0) + s.spent;
  }
  const rounds = new Map();
  for (const s of trace.snapshots.filter(s => s.pid === p.playerId && ['SETTLE', 'RESULT', 'FINAL_ASSAULT', 'HIDDEN_CORE'].includes(s.phase))) rounds.set(s.round, s);
  return [`# ${p.victory ? 'WIN' : 'LOSS'} · seat ${seat}`, `Version ${record.version}; seed ${record.seed}; ${record.mode} ${record.difficulty}.`,
    `Reached round ${record.round}; passed ${p.roundsPassed}; LP ${p.lp}; team LP ${record.summary.teamLp ?? '—'}.`,
    `FA damage ${record.fa?.damageBySeat[seat] ?? 0} / pool ${record.fa?.pool ?? 'not reached'}; remaining ${record.fa?.remaining ?? '—'}.`,
    `External fallbacks: ${record.external?.bySeat[seat]?.fallbacks || 0}.`,
    '\n## Banked layers per round (settlement / result)',
    ...[...rounds].map(([r, s]) => `R${r} LP=${s.lp}: ${Object.entries(s.layers).map(([b, l]) => `${names[b] || b}(${b})=${l}`).join('; ') || 'none'}`),
    '\n## Gold spent by kind', ...Object.entries(spent).map(([k, v]) => `${k}: ${v}`), `Total: ${p.stats.gold}`,
    '\n## Final host feedback', ...(record.finalFeedback?.[seat] || []).map(r => `${r.ok ? 'ACCEPTED' : 'REJECTED'} ${json(r.intent)}: ${r.error || 'ok'} ${r.detail || ''}`),
    '\nFull match summary, layer provenance and spending: result.json.'].join('\n') + '\n';
}
