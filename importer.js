
function parseCSV(text){
  const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(',').map(h=>h.trim());
  return lines.map(line=>{
    const cols = line.split(',').map(c=>c.trim());
    const row = {};
    headers.forEach((h,i)=>row[h]=cols[i] ?? '');
    return row;
  });
}
function toBaseUnit(unit, value){
  const u = (unit||'').toLowerCase();
  if(u==='l') return { unit:'ml', value: Number(value)*1000 };
  if(u==='kg') return { unit:'g', value: Number(value)*1000 };
  return { unit: u, value: Number(value) };
}
function computeCostPerUnit(row){
  if(row.cost_per_unit_eur) return Number(row.cost_per_unit_eur);
  if(row.pack_size && row.pack_cost_eur){
    const conv = toBaseUnit(row.pack_unit, row.pack_size);
    return Number(row.pack_cost_eur) / (conv.value||1);
  }
  return 0;
}
let IMPORT_ROWS = [];
function previewImport(rows, el){
  const headers = ['service_name','material_name','sku','supplier','units_per_service','unit','pack_size','pack_unit','pack_cost_eur','waste_factor_pct','cost_per_unit_eur','material_cost_per_service'];
  const tbl = ['<tr>'+headers.map(h=>`<th>${h}</th>`).join('')+'</tr>'];
  for(const r of rows){
    const cpu = computeCostPerUnit(r);
    const units = Number(r.units_per_service||0);
    const w = Number(r.waste_factor_pct||0);
    const eff = units*(1+w/100);
    const mcost = cpu * toBaseUnit(r.unit, eff).value;
    tbl.push('<tr>'+headers.map(h=>{
      let val = r[h] ?? '';
      if(h==='cost_per_unit_eur') val = cpu.toFixed(4);
      if(h==='material_cost_per_service') val = mcost.toFixed(4);
      return `<td>${val}</td>`;
    }).join('')+'</tr>');
  }
  el.innerHTML = `<table>${tbl.join('')}</table>`;
}
async function applyImport(rows){
  const materials = await DB.all('materials');
  const services = await DB.all('services');
  const matIndex = new Map(materials.map(m=>[(m.sku||m.name||'')+'|'+(m.supplier||''), m]));
  const svcIndex = new Map(services.map(s=>[s.name, s]));
  for(const r of rows){
    const key = (r.sku||r.material_name||'')+'|'+(r.supplier||'');
    let m = matIndex.get(key);
    const cpu = computeCostPerUnit(r);
    const baseUnits = toBaseUnit(r.unit, r.units_per_service||0).value;
    if(!m){
      m = { name:r.material_name, sku:r.sku||'', supplier:r.supplier||'', unit: (toBaseUnit(r.pack_unit||r.unit||'ml',1).unit), costPerUnit: cpu };
      m.id = await DB.add('materials', m);
      matIndex.set(key, m);
    }else{
      m.costPerUnit = cpu || m.costPerUnit;
      await DB.put('materials', m);
    }
    let s = svcIndex.get(r.service_name);
    if(!s){
      s = { name: r.service_name, price: 0, defaultVatRate: 23, targetMargin: 70 };
      s.id = await DB.add('services', s);
      svcIndex.set(s.name, s);
    }
    await DB.add('service_materials', { serviceId: s.id, materialId: m.id, unitsPerService: baseUnits });
  }
}
window.Importer = { parseCSV, previewImport, applyImport, IMPORT_ROWS };
