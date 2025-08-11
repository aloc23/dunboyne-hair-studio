
function currency(x){ return (Number(x)||0).toFixed(2); }

function initCostAnalyzer(seed){
  const svcSel = document.getElementById('ca-service');
  svcSel.innerHTML = '';
  seed.services.forEach(s=>{
    const o = document.createElement('option'); o.value=s.id; o.textContent=s.name; svcSel.appendChild(o);
  });
  svcSel.addEventListener('change', renderCA);
  ['ca-minutes','ca-target','ca-overhead','ca-labour','ca-vat'].forEach(id=>document.getElementById(id).addEventListener('input', renderCA));
  renderCA();
  function renderCA(){
    const sid = svcSel.value;
    const mins = Number(document.getElementById('ca-minutes').value||0);
    const overhead = Number(document.getElementById('ca-overhead').value||0);
    const labour = Number(document.getElementById('ca-labour').value||0);
    const vat = Number(document.getElementById('ca-vat').value||0);
    const target = Number(document.getElementById('ca-target').value||0)/100.0;
    const mats = seed.service_materials.filter(x=>x.serviceId===sid);
    const matRows = mats.map(m=>{
      const mat = seed.materials.find(mm=>mm.id===m.materialId);
      const cost = (m.unitsPerService * (mat.costPerUnit||0));
      return {name: mat.name, qty: m.unitsPerService, unit: mat.unit, cpu: mat.costPerUnit, cost};
    });
    const materialsCost = matRows.reduce((s,r)=>s+r.cost,0);
    const labourCost = mins * labour;
    const overheadCost = mins * overhead;
    const trueCost = materialsCost + labourCost + overheadCost;
    // price suggestion net to hit target margin
    const priceNet = trueCost/(1-target);
    const priceGross = priceNet * (1+vat);
    const html = `
      <div class="kpi"><div class="kpi"><h3>Materials</h3><div class="v">€ ${currency(materialsCost)}</div></div>
      <div class="kpi"><h3>Labour</h3><div class="v">€ ${currency(labourCost)}</div></div>
      <div class="kpi"><h3>Overhead</h3><div class="v">€ ${currency(overheadCost)}</div></div>
      <div class="kpi"><h3>True Cost</h3><div class="v">€ ${currency(trueCost)}</div></div>
      <div class="kpi"><h3>Suggest Net</h3><div class="v">€ ${currency(priceNet)}</div></div>
      <div class="kpi"><h3>Suggest Gross</h3><div class="v">€ ${currency(priceGross)}</div></div>`;
    document.getElementById('ca-output').innerHTML = html;
    // materials table
    const mhtml = '<table><tr><th>Material</th><th>Qty</th><th>Unit</th><th>€/unit</th><th>Cost</th></tr>' +
      matRows.map(r=>`<tr><td>${r.name}</td><td>${r.qty}</td><td>${r.unit}</td><td>${currency(r.cpu)}</td><td>€ ${currency(r.cost)}</td></tr>`).join('') + '</table>';
    document.getElementById('materials-list').innerHTML = mhtml;
  }
}
