import { DB } from './db.js';

function fmt(n){ return '€'+(Math.round(n*100)/100).toFixed(2); }

async function loadCatalog(){
  const services = await DB.getAll('services');
  const materials = await DB.getAll('materials');
  const maps = await DB.getAll('service_materials');
  return {services, materials, maps};
}

async function populateServiceDropdown(){
  const {services} = await loadCatalog();
  const sel = document.getElementById('costService');
  sel.innerHTML = '';
  for(const s of services){
    const opt = document.createElement('option'); opt.value=s.id; opt.textContent=s.name; sel.appendChild(opt);
  }
}

async function calculate(){
  const {services, materials, maps} = await loadCatalog();
  const sid = document.getElementById('costService').value;
  const mins = Number(document.getElementById('costMinutes').value||0);
  const lab = Number(document.getElementById('labourPerMin').value||0);
  const oh  = Number(document.getElementById('overheadPerMin').value||0);
  const target = Number(document.getElementById('targetMargin').value||0)/100;

  const s = services.find(x=>x.id===sid);
  const mFor = maps.filter(m=>m.serviceId===sid);
  let materialsCost = 0;
  const lines = [];
  for(const m of mFor){
    const mat = materials.find(x=>x.id===m.materialId);
    const c = (mat?.costPerUnit||0) * (m.unitsPerService||0);
    materialsCost += c;
    lines.push(`<tr><td>${mat?.name||m.materialId}</td><td>${m.unitsPerService} ${mat?.unit||''}</td><td>${fmt(mat?.costPerUnit||0)}</td><td>${fmt(c)}</td></tr>`);
  }
  const labourCost = mins*lab;
  const overheadCost = mins*oh;
  const trueCost = materialsCost + labourCost + overheadCost;
  const priceNet = s?.price||0;
  const margin = priceNet>0 ? (priceNet - trueCost)/priceNet : 0;
  const recommended = trueCost/(1-target||1);

  const out = `
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr></thead>
    <tbody>${lines.join('')}</tbody>
    <tfoot>
      <tr><td>Materials</td><td></td><td></td><td>${fmt(materialsCost)}</td></tr>
      <tr><td>Labour</td><td>${mins} min</td><td>${fmt(lab)}/min</td><td>${fmt(labourCost)}</td></tr>
      <tr><td>Overhead</td><td>${mins} min</td><td>${fmt(oh)}/min</td><td>${fmt(overheadCost)}</td></tr>
      <tr><td><strong>True Cost</strong></td><td></td><td></td><td><strong>${fmt(trueCost)}</strong></td></tr>
      <tr><td>Current Net Price</td><td></td><td></td><td>${fmt(priceNet)}</td></tr>
      <tr><td>Margin %</td><td></td><td></td><td>${(margin*100).toFixed(1)}%</td></tr>
      <tr><td>Recommended Net Price @ ${(target*100).toFixed(0)}%</td><td></td><td></td><td>${fmt(recommended)}</td></tr>
    </tfoot>
  </table>`;
  document.getElementById('costOut').innerHTML = out;
}

export async function initCost(){
  await populateServiceDropdown();
}
document.getElementById('calcCost').addEventListener('click', calculate);
document.addEventListener('tab:cost', initCost);
