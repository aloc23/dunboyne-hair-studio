import { DB } from './db.js';

let parsedRows = [];

document.getElementById('parseCsv').addEventListener('click', async ()=>{
  const file = document.getElementById('csvFile').files[0];
  if(!file){ alert('Choose a CSV first'); return; }
  const text = await file.text();
  const rows = text.split(/\r?\n/).map(r=>r.split(','));
  const header = rows.shift();
  parsedRows = rows.filter(r=>r.length===header.length).map(r=>Object.fromEntries(header.map((h,i)=>[h.trim(), r[i] ? r[i].trim() : ''])));
  const preview = document.getElementById('csvPreview');
  preview.innerHTML = `<pre>${header.join(', ')}\n` + parsedRows.slice(0,10).map(r=>JSON.stringify(r)).join('\n') + `\n... (${parsedRows.length} rows)</pre>`;
});

document.getElementById('applyCsv').addEventListener('click', async ()=>{
  if(parsedRows.length===0){ alert('Parse a CSV first'); return; }
  const materials = await DB.getAll('materials');
  const services = await DB.getAll('services');
  const matByName = Object.fromEntries(materials.map(m=>[m.name.toLowerCase(), m]));
  const svcByName = Object.fromEntries(services.map(s=>[s.name.toLowerCase(), s]));

  for(const r of parsedRows){
    const sname = r.service_name || r.service || r.Service;
    const mname = r.material_name || r.material || r.Material;
    if(!sname || !mname) continue;
    let svc = svcByName[sname.toLowerCase()];
    if(!svc){ svc = {id:'svc_'+Date.now()+Math.random().toString(16).slice(2), name:sname, price:0, defaultVatRate:0.23, targetMargin:0.6}; await DB.put('services',svc); svcByName[sname.toLowerCase()] = svc; }
    let mat = matByName[mname.toLowerCase()];
    if(!mat){ mat = {id:'mat_'+Date.now()+Math.random().toString(16).slice(2), name:mname, unit:r.unit||'ml', costPerUnit:Number(r.cost_per_unit_eur||0), sku:r.sku||'', supplier:r.supplier||''}; await DB.put('materials',mat); matByName[mname.toLowerCase()] = mat; }
    const units = Number(r.units_per_service||r.units||0);
    const map = {id:'map_'+svc.id+'_'+mat.id+'_'+Date.now(), serviceId:svc.id, materialId:mat.id, unitsPerService:units};
    await DB.put('service_materials', map);
  }
  alert('Applied CSV to catalog.');
});

