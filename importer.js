
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
  const headers = lines[0].split(',').map(h=>h.trim());
  const rows = lines.slice(1).map(l=>{
    const cells = l.split(',').map(c=>c.trim());
    const obj = {}; headers.forEach((h,i)=>obj[h]=cells[i]); return obj;
  });
  return {headers, rows};
}
let lastImport = null;
document.getElementById('parse-csv').addEventListener('click', ()=>{
  const f = document.getElementById('csv-file').files[0];
  if(!f){ alert('Choose a CSV file'); return; }
  const r = new FileReader();
  r.onload = ()=>{
    const {headers, rows} = parseCSV(r.result);
    lastImport = rows;
    document.getElementById('csv-preview').innerHTML = `<div class='hint'>${rows.length} rows parsed.</div>`;
    document.getElementById('apply-import').disabled = false;
  };
  r.readAsText(f);
});

document.getElementById('apply-import').addEventListener('click', ()=>{
  if(!lastImport){ alert('Parse a CSV first'); return; }
  const cat = DB.data.catalog;
  const ensureMat = (name, unit)=>{
    let m = cat.materials.find(x=>x.name===name);
    if(!m){
      m = {id: 'mat_'+name.toLowerCase().replace(/[^a-z0-9]+/g,'_'), name, unit: unit||'ml', costPerUnit: 0};
      cat.materials.push(m);
    }
    return m;
  };
  const ensureSvc = (name)=>{
    let s = cat.services.find(x=>x.name===name);
    if(!s){
      s = {id: 'svc_'+name.toLowerCase().replace(/[^a-z0-9]+/g,'_'), name, price:50, defaultVatRate:0.23, targetMargin:0.6};
      cat.services.push(s);
    }
    return s;
  };
  const ensureSM = (sid, mid)=>{
    let sm = cat.service_materials.find(x=>x.serviceId===sid && x.materialId===mid);
    if(!sm){
      sm = {id: sid+'_'+mid, serviceId:sid, materialId:mid, unitsPerService:0};
      cat.service_materials.push(sm);
    }
    return sm;
  };
  lastImport.forEach(r=>{
    const sname = r.service_name;
    const mname = r.material_name;
    if(!sname || !mname) return;
    const unit = r.unit || 'ml';
    const units = Number(r.units_per_service||0);
    const packSize = Number(r.pack_size||0);
    const packUnit = r.pack_unit || unit;
    const packCost = Number(r.pack_cost_eur||0);
    let cpu = Number(r.cost_per_unit_eur||0);
    // compute cpu if not provided
    if(cpu===0 && packSize>0 && packCost>0){
      let factor = 1;
      if(packUnit==='L' && unit==='ml') factor = 1000;
      if(packUnit==='kg' && unit==='g') factor = 1000;
      if(packUnit===unit) factor = 1;
      cpu = packCost/(packSize*factor);
    }
    const waste = Number(r.waste_factor_pct||0);
    const effUnits = units*(1+waste/100);
    const mat = ensureMat(mname, unit);
    if(cpu>0) mat.costPerUnit = cpu;
    const svc = ensureSvc(sname);
    const sm = ensureSM(svc.id, mat.id);
    sm.unitsPerService = effUnits;
  });
  DB.data.catalog = cat; DB.save();
  alert('Import applied. Check Cost Analyzer.');
  initCostAnalyzer(cat);
});
