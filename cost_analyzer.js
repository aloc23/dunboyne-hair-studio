
import { add, getAll } from './db.js';

function toMoney(n) { return '€' + (n||0).toFixed(2); }

export function computeTrueCost(model) {
  const labour = (model.mins/60) * model.labourRate;
  const materials = (model.materials||[]).reduce((a,m)=> a + (m.units * m.costPerUnit), 0);
  const ops = model.overheadPerService || 0;
  const trueCost = labour + materials + ops;
  const marginPct = model.priceNet>0 ? ( (model.priceNet - trueCost)/model.priceNet * 100 ) : 0;
  return { labour, materials, ops, trueCost, marginPct };
}

export async function saveAnalysis(model) {
  const res = computeTrueCost(model);
  const rec = {
    service: model.name, priceNet: model.priceNet, targetMargin: model.targetMargin,
    mins: model.mins, labourRate: model.labourRate, overheadPerService: model.overheadPerService,
    materials: model.materials, result: res, createdAt: new Date().toISOString()
  };
  await add('analyses', rec);
  return rec;
}

export async function listAnalyses() {
  const all = await getAll('analyses');
  return all.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
}
