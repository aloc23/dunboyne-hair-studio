
function addMaterialRow(container){
  const row = document.createElement('div');
  row.className='grid-3';
  row.innerHTML = `
    <label>Material <input type="text" class="mat-name"></label>
    <label>Units used <input type="number" step="0.001" class="mat-units" value="1"></label>
    <label>€/unit <input type="number" step="0.0001" class="mat-cost" value="0.10"></label>
  `;
  container.appendChild(row);
}
function computeCost(params){
  const materialsCost = params.materials.reduce((sum,m)=>sum + m.units*m.cost, 0);
  const labour = (Number(params.mins||0)/60) * Number(params.rate||0);
  const overhead = Number(params.overhead||0);
  const trueCost = materialsCost + labour + overhead;
  const vatRate = Number(params.vat||0)/100;
  const priceNet = Number(params.price||0) / (1+vatRate);
  const margin = priceNet - trueCost;
  const marginPct = priceNet ? (margin/priceNet)*100 : 0;
  const target = Number(params.target||0)/100;
  const targetNet = trueCost / (1-target);
  const recommendation = Math.round((targetNet * (1+vatRate)) * 2)/2;
  return {materialsCost, labour, overhead, trueCost, priceNet, margin, marginPct, recommendation};
}
async function saveAnalysis(a){
  a.createdAt = new Date().toISOString();
  await DB.add('analyses', a);
}
window.Cost = { addMaterialRow, computeCost, saveAnalysis };
