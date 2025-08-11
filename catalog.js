import { DB } from './db.js';

function el(tag, attrs={}, children=[]){
  const e = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){ if(k==='class') e.className=v; else e.setAttribute(k,v); }
  for(const c of children){ if(typeof c==='string') e.appendChild(document.createTextNode(c)); else e.appendChild(c); }
  return e;
}

async function loadCatalog(){
  const services = await DB.getAll('services');
  const materials = await DB.getAll('materials');
  const maps = await DB.getAll('service_materials');
  return {services, materials, maps};
}

async function renderServices(){
  const wrap = document.getElementById('servicesList'); wrap.innerHTML='';
  const {services, materials, maps} = await loadCatalog();
  for(const s of services){
    const mFor = maps.filter(m=>m.serviceId===s.id).map(m=>{
      const mat = materials.find(x=>x.id===m.materialId);
      return {...m, materialName: mat?.name||m.materialId};
    });
    const card = el('div',{class:'card'},[
      el('div',{},[el('strong',{},[s.name])]),
      el('label',{},['Price €', el('input',{type:'number',step:'0.01',value:s.price||0,onchange:(e)=>{s.price=Number(e.target.value)}})]),
      el('div',{},[el('em',{},['Materials:'])]),
      el('table',{},[
        el('thead',{},[el('tr',{},[el('th',{},['Material']),el('th',{},['Units/Service']),el('th',{},['Actions'])])]),
        el('tbody',{}, mFor.map(m=>el('tr',{},[
          el('td',{},[m.materialName]),
          el('td',{},[String(m.unitsPerService)]),
          el('td',{},[el('button',{onclick:async()=>{ await removeMap(m.id); renderServices(); }},['Remove'])])
        ])))
      ]),
      el('div',{},[
        el('button',{onclick:()=>openAddMatDialog(s.id)},['Add Material'])
      ]),
      el('div',{},[el('button',{onclick:async()=>{await DB.put('services',s); alert('Saved');}},['Save Service'])])
    ]);
    wrap.appendChild(card);
  }
}

async function removeMap(id){
  return new Promise((res,rej)=>{
    const tx = DB.db.transaction('service_materials','readwrite');
    tx.objectStore('service_materials').delete(id);
    tx.oncomplete=()=>res(); tx.onerror=(e)=>rej(e);
  });
}

async function openAddMatDialog(serviceId){
  const {materials} = await loadCatalog();
  const name = prompt('Material name (pick or new):\n'+materials.map(m=>m.name).join(', '));
  if(!name) return;
  let mat = materials.find(m=>m.name.toLowerCase()===name.toLowerCase());
  if(!mat){
    mat = {id:'mat_'+Date.now(), name, unit:'ml', costPerUnit:0, sku:'', supplier:''};
    await DB.put('materials', mat);
  }
  const units = Number(prompt('Units per service (in '+mat.unit+')','0'));
  const map = {id:'map_'+serviceId+'_'+mat.id+'_'+Date.now(), serviceId, materialId: mat.id, unitsPerService: units};
  await DB.put('service_materials', map);
  alert('Added');
  await renderServices();
}

async function renderMaterials(){
  const wrap = document.getElementById('materialsList'); wrap.innerHTML='';
  const materials = await DB.getAll('materials');
  const table = el('table',{},[
    el('thead',{},[el('tr',{},[el('th',{},['Name']),el('th',{},['Unit']),el('th',{},['Cost/Unit €']),el('th',{},['SKU']),el('th',{},['Supplier']),el('th',{},['Actions'])])]),
    el('tbody',{}, materials.map(m=>{
      const row = el('tr',{});
      const name = el('input',{value:m.name,onchange:(e)=>m.name=e.target.value});
      const unit = el('input',{value:m.unit,onchange:(e)=>m.unit=e.target.value});
      const cpu = el('input',{type:'number',step:'0.0001',value:m.costPerUnit||0,onchange:(e)=>m.costPerUnit=Number(e.target.value)});
      const sku = el('input',{value:m.sku||'',onchange:(e)=>m.sku=e.target.value});
      const sup = el('input',{value:m.supplier||'',onchange:(e)=>m.supplier=e.target.value});
      const saveBtn = el('button',{onclick:async()=>{await DB.put('materials',m); alert('Saved');}},['Save']);
      row.appendChild(el('td',{},[name]));
      row.appendChild(el('td',{},[unit]));
      row.appendChild(el('td',{},[cpu]));
      row.appendChild(el('td',{},[sku]));
      row.appendChild(el('td',{},[sup]));
      row.appendChild(el('td',{},[saveBtn]));
      return row;
    }))
  ]);
  wrap.appendChild(table);
}

export async function initCatalog(){
  await renderServices();
  await renderMaterials();
}

document.addEventListener('tab:services', initCatalog);
