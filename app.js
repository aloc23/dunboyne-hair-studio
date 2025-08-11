
import { openDB, tx, getAll, put, add, del } from './lib-idb.js';
import { seedServices, seedExpenseCats, seedUtilitiesPerMonth } from './seed-data.js';

const € = (n)=>`€${Number(n||0).toFixed(2)}`;

// ---- DB ----
let db;
async function initDB(){
  db = await openDB('salon-accounts', 2, (db, oldV, newV)=>{
    if (oldV < 1){
      db.createObjectStore('settings',{keyPath:'key'});
      db.createObjectStore('services',{keyPath:'id', autoIncrement:true});
      db.createObjectStore('journal',{keyPath:'id', autoIncrement:true}); // entries
      db.createObjectStore('takings',{keyPath:'id', autoIncrement:true});
      db.createObjectStore('expenses',{keyPath:'id', autoIncrement:true});
      db.createObjectStore('expenseCats',{keyPath:'name'});
      db.createObjectStore('materials',{keyPath:'sku'}); // SKU price list
      db.createObjectStore('usage',{keyPath:'id', autoIncrement:true}); // {serviceId, sku, qty}
      db.createObjectStore('locks',{keyPath:'period'}); // month close lock
      // indexes
      db.transaction.objectStore('usage').createIndex('byService','serviceId');
      db.transaction.objectStore('journal').createIndex('byDate','date');
    }
    if (oldV < 2){
      // future migrations
    }
  });
  await seedIfEmpty();
}

async function seedIfEmpty(){
  const t = tx(db, ['services','settings','expenseCats','materials'],'readwrite');
  const existing = await getAll(t,'services');
  if (!existing.length){
    for (const s of seedServices){
      await add(t,'services', {...s});
    }
  }
  const vatMode = await t.objectStore('settings').get('vatMode');
  if (!vatMode) await put(t,'settings', {key:'vatMode', value:'include'});
  const vatRate = await t.objectStore('settings').get('vatRate');
  if (!vatRate) await put(t,'settings', {key:'vatRate', value:0.23});

  const cats = await getAll(t,'expenseCats');
  if (!cats.length){
    for (const c of seedExpenseCats) await add(t,'expenseCats',{name:c});
  }

  // Utilities seeds
  const utilRows = await t.objectStore('settings').get('utilities');
  if (!utilRows){
    await put(t,'settings',{key:'utilities', value: seedUtilitiesPerMonth.map(([name, monthly])=>({name, monthly})) });
  }
}

// ---- UI Helpers ----
function byId(id){ return document.getElementById(id); }
function setText(el, text){ el.textContent = text; }
function sum(arr){ return arr.reduce((a,b)=>a+Number(b||0),0); }
function fmtMonth(date){ const d = new Date(date); return d.toISOString().slice(0,7); }

// ---- Tabs ----
function initTabs(){
  const bar = byId('tabbar');
  const tabs = bar.querySelectorAll('.tab');
  tabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      tabs.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const name = btn.dataset.tab;
      document.querySelectorAll('section.section').forEach(sec=>{
        sec.classList.toggle('active', sec.dataset.section===name);
      });
    });
  });
}

// ---- Settings ----
async function loadSettingsForm(){
  const t = tx(db,['settings'],'readonly');
  const vatMode = await t.objectStore('settings').get('vatMode');
  const vatRate = await t.objectStore('settings').get('vatRate');
  byId('vat-mode').value = (vatMode && vatMode.value) || 'include';
  byId('vat-rate').value = (vatRate && vatRate.value) || 0.23;
  await renderUtilities();
}
async function renderUtilities(){
  const body = byId('utils-table').querySelector('tbody');
  body.innerHTML = '';
  const t = tx(db,['settings'],'readonly');
  const utils = (await t.objectStore('settings').get('utilities'))?.value || [];
  for (let i=0;i<utils.length;i++){
    const u = utils[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input value="${u.name}"/></td>
      <td><input type="number" step="0.01" value="${u.monthly}"/></td>
      <td><button class="btn" data-del="${i}">Delete</button></td>`;
    body.appendChild(tr);
  }
  // total €/hr
  const totalMonth = utils.reduce((a,u)=>a+Number(u.monthly||0),0);
  const perHour = totalMonth / (30*8) ; // rough: 8h/day, 30 days
  setText(byId('utils-hour'), €(perHour));
  body.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const idx = Number(btn.dataset.del);
      utils.splice(idx,1);
      const t2 = tx(db,['settings'],'readwrite');
      await put(t2,'settings',{key:'utilities', value: utils});
      renderUtilities();
    });
  });
}
byId('add-util').addEventListener('click', async ()=>{
  const t = tx(db,['settings'],'readwrite');
  const utils = (await t.objectStore('settings').get('utilities'))?.value || [];
  utils.push({name:'New', monthly:0});
  await put(t,'settings',{key:'utilities', value: utils});
  renderUtilities();
});
byId('vat-mode').addEventListener('change', async (e)=>{
  const t = tx(db,['settings'],'readwrite'); await put(t,'settings',{key:'vatMode', value:e.target.value});
});
byId('vat-rate').addEventListener('change', async (e)=>{
  const t = tx(db,['settings'],'readwrite'); await put(t,'settings',{key:'vatRate', value:Number(e.target.value)});
});

// ---- Catalog ----
async function loadCatalog(){
  const t = tx(db,['services'],'readonly');
  const list = await getAll(t,'services');
  const tbody = byId('catalog-table').querySelector('tbody');
  tbody.innerHTML = '';
  for (const s of list){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input data-f="name" data-id="${s.id}" value="${s.name}"/></td>
      <td><input type="number" step="0.01" data-f="price" data-id="${s.id}" value="${s.price}"/></td>
      <td><input type="number" step="1" data-f="mins" data-id="${s.id}" value="${s.mins}"/></td>
      <td><input type="number" step="0.01" data-f="products" data-id="${s.id}" value="${s.products}"/></td>
      <td><input type="number" step="0.01" data-f="utilities" data-id="${s.id}" value="${s.utilities}"/></td>
      <td><input type="number" step="0.01" data-f="labour" data-id="${s.id}" value="${s.labour}"/></td>
      <td><input type="number" step="0.01" data-f="total" data-id="${s.id}" value="${s.total}"/></td>
      <td><button class="btn" data-del="${s.id}">Delete</button></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('input[data-f]').forEach(inp=>{
    inp.addEventListener('change', async ()=>{
      const id = Number(inp.dataset.id);
      const f = inp.dataset.f;
      const t2 = tx(db,['services'],'readwrite');
      const list2 = await getAll(t2,'services');
      const s = list2.find(x=>x.id===id);
      s[f] = (f==='name')?inp.value:Number(inp.value);
      await put(t2,'services',s);
      loadServiceDropdowns();
    });
  });
  tbody.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = Number(btn.dataset.del);
      const t2 = tx(db,['services'],'readwrite');
      await del(t2,'services', id);
      loadCatalog();
      loadServiceDropdowns();
    });
  });
}
byId('add-service-row').addEventListener('click', async ()=>{
  const t = tx(db,['services'],'readwrite');
  await add(t,'services',{name:'New Service', price:0, mins:0, products:0, utilities:0, labour:0, total:0});
  await loadCatalog();
  loadServiceDropdowns();
});
byId('export-price-list').addEventListener('click', async ()=>{
  const t = tx(db,['services'],'readonly'); const list = await getAll(t,'services');
  const w = window.open('', '_blank');
  w.document.write('<h1>Price List</h1><table border="1" cellpadding="6"><tr><th>Service</th><th>Price</th><th>Duration</th></tr>');
  for (const s of list){
    w.document.write(`<tr><td>${s.name}</td><td>${€(s.price)}</td><td>${s.mins} mins</td></tr>`);
  }
  w.document.write('</table>');
  w.document.close();
  w.print();
});

// ---- Dropdown sources ----
async function loadServiceDropdowns(){
  const t = tx(db,['services'],'readonly');
  const list = await getAll(t,'services');
  const selects = [byId('service-select'), byId('usage-service-select'), byId('analyzer-service')];
  for (const sel of selects){
    sel.innerHTML = '';
    for (const s of list){
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.name;
      sel.appendChild(opt);
    }
  }
}

// ---- Materials & Usage ----
async function renderSKUs(){
  const t = tx(db,['materials'],'readonly');
  const skus = await getAll(t,'materials');
  const tbody = byId('sku-table').querySelector('tbody');
  tbody.innerHTML='';
  for (const m of skus){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input value="${m.sku}" data-sku="${m.sku}" data-f="sku"/></td>
      <td><input value="${m.name}" data-sku="${m.sku}" data-f="name"/></td>
      <td><input value="${m.unit}" data-sku="${m.sku}" data-f="unit"/></td>
      <td><input type="number" step="0.0001" value="${m.costPerUnit}" data-sku="${m.sku}" data-f="costPerUnit"/></td>
      <td><button class="btn" data-del="${m.sku}">Delete</button></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('input[data-f]').forEach(inp=>{
    inp.addEventListener('change', async ()=>{
      const sku = inp.dataset.sku;
      const f = inp.dataset.f;
      const t2 = tx(db,['materials'],'readwrite');
      const all = await getAll(t2,'materials');
      const row = all.find(x=>x.sku===sku);
      if (f==='costPerUnit') row[f]=Number(inp.value);
      else row[f]=inp.value;
      await put(t2,'materials',row);
      recalcUsageCost();
    });
  });
  tbody.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const sku = btn.dataset.del;
      const t2 = tx(db,['materials'],'readwrite'); await del(t2,'materials',sku);
      renderSKUs();
    });
  });
}
byId('add-sku').addEventListener('click', async ()=>{
  const sku = prompt('Enter new SKU code');
  if (!sku) return;
  const name = prompt('Name'); const unit = prompt('Unit (ml/g/each)', 'ml'); const cpu = Number(prompt('Cost per unit (€)', '0.01'));
  const t = tx(db,['materials'],'readwrite');
  await put(t,'materials',{sku, name:name||sku, unit:unit||'ml', costPerUnit:cpu||0.01});
  renderSKUs();
});

let currentUsageServiceId = null;
byId('usage-service-select').addEventListener('change', ()=>{
  currentUsageServiceId = Number(byId('usage-service-select').value);
  renderUsageTable();
});
async function renderUsageTable(){
  if (!currentUsageServiceId){ 
    const sel = byId('usage-service-select');
    currentUsageServiceId = Number(sel.value)||null;
    if (!currentUsageServiceId) return;
  }
  const t = tx(db,['usage','materials'],'readonly');
  const rows = await t.objectStore('usage').index('byService').getAll(currentUsageServiceId);
  const skus = await getAll(t,'materials');
  const tbody = byId('usage-table').querySelector('tbody');
  tbody.innerHTML = '';
  for (const u of rows){
    const sku = skus.find(x=>x.sku===u.sku);
    const cpu = sku?Number(sku.costPerUnit):0;
    const line = (cpu*Number(u.qty||0));
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.sku}</td><td>${sku?sku.name:''}</td><td>${sku?sku.unit:''}</td>
      <td>${€(cpu)}</td>
      <td><input type="number" step="0.01" value="${u.qty}" data-uid="${u.id}" /></td>
      <td>${€(line)}</td>
      <td><button class="btn" data-del="${u.id}">Delete</button></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('input[data-uid]').forEach(inp=>{
    inp.addEventListener('change', async ()=>{
      const id = Number(inp.dataset.uid);
      const t2 = tx(db,['usage'],'readwrite');
      const all = await getAll(t2,'usage');
      const row = all.find(x=>x.id===id);
      row.qty = Number(inp.value);
      await put(t2,'usage',row);
      renderUsageTable();
      recalcUsageCost();
    });
  });
  tbody.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = Number(btn.dataset.del);
      const t2 = tx(db,['usage'],'readwrite'); await del(t2,'usage', id);
      renderUsageTable();
      recalcUsageCost();
    });
  });
  recalcUsageCost();
}
async function recalcUsageCost(){
  const serviceId = currentUsageServiceId;
  if (!serviceId) { setText(byId('usage-total'), €(0)); return; }
  const t = tx(db,['usage','materials','services'],'readonly');
  const rows = await t.objectStore('usage').index('byService').getAll(serviceId);
  const skus = await getAll(t,'materials');
  let total = 0;
  for (const u of rows){
    const sku = skus.find(x=>x.sku===u.sku);
    if (sku) total += Number(sku.costPerUnit)*Number(u.qty||0);
  }
  setText(byId('usage-total'), €(total));
  // write products cost back into service
  const t2 = tx(db,['services'],'readwrite');
  const all = await getAll(t2,'services');
  const svc = all.find(x=>x.id===serviceId);
  if (svc){ svc.products = Number(total.toFixed(2)); await put(t2,'services', svc); }
  await loadCatalog(); // reflect
}

// add usage row
byId('add-usage-row').addEventListener('click', async ()=>{
  const serviceId = Number(byId('usage-service-select').value);
  if (!serviceId){ alert('Choose a service first'); return; }
  const sku = prompt('SKU code (must exist in SKU list)');
  if (!sku) return;
  const qty = Number(prompt('Qty used (in SKU unit)', '1'));
  const t = tx(db,['materials'],'readonly'); const all = await getAll(t,'materials');
  if (!all.find(x=>x.sku===sku)) { alert('SKU not found. Add it to SKU list first.'); return; }
  const t2 = tx(db,['usage'],'readwrite');
  await add(t2,'usage',{serviceId, sku, qty});
  renderUsageTable();
});

// ---- Analyzer ----
async function loadAnalyzer(){
  await loadServiceDropdowns();
}
byId('load-service-into-analyzer').addEventListener('click', async ()=>{
  const id = Number(byId('analyzer-service').value);
  const t = tx(db,['services','settings'],'readonly');
  const list = await getAll(t,'services');
  const s = list.find(x=>x.id===id);
  const utils = (await t.objectStore('settings').get('utilities'))?.value || [];
  const totalMonth = utils.reduce((a,u)=>a+Number(u.monthly||0),0);
  const perHour = totalMonth / (30*8);
  byId('w-price').value = s.price;
  byId('w-mins').value = s.mins;
  byId('w-utils-per-hour').value = perHour.toFixed(2);
  byId('w-products').value = s.products;
  byId('w-labour').value = s.labour;
  byId('w-ops').value = 0;
  recalcAnalyzer();
});
function recalcAnalyzer(){
  const vatRate = Number(byId('vat-rate').value||0.23);
  const priceIncl = Number(byId('w-price').value||0);
  const mins = Number(byId('w-mins').value||0);
  const utilsHr = Number(byId('w-utils-per-hour').value||0);
  const products = Number(byId('w-products').value||0);
  const labour = Number(byId('w-labour').value||0);
  const ops = Number(byId('w-ops').value||0);
  const utilsCost = (mins/60)*utilsHr;
  const totalCost = products + labour + ops + utilsCost;
  const priceNet = priceIncl / (1+vatRate);
  const margin€ = priceNet - totalCost;
  const marginPct = (priceNet>0)? (margin€/priceNet)*100 : 0;
  const target = Number(byId('target-margin').value||65)/100;
  const suggestedNet = totalCost / (1-target);
  const suggestedIncl = suggestedNet*(1+vatRate);
  setText(byId('r-utils'), €(utilsCost));
  setText(byId('r-total'), €(totalCost));
  setText(byId('r-price-net'), €(priceNet));
  setText(byId('r-margin-eur'), €(margin€));
  setText(byId('r-margin-pct'), `${marginPct.toFixed(1)}%`);
  setText(byId('r-suggested'), €(suggestedIncl));
}
byId('recalc').addEventListener('click', recalcAnalyzer);
byId('save-to-catalog').addEventListener('click', async ()=>{
  const id = Number(byId('analyzer-service').value);
  const t = tx(db,['services'],'readwrite');
  const list = await getAll(t,'services');
  const s = list.find(x=>x.id===id);
  s.price = Number(byId('w-price').value||0);
  s.mins = Number(byId('w-mins').value||0);
  s.products = Number(byId('w-products').value||0);
  s.labour = Number(byId('w-labour').value||0);
  s.utilities = Number(byId('r-utils').textContent.replace('€','')||0);
  s.total = Number(byId('r-total').textContent.replace('€','')||0);
  await put(t,'services',s);
  await loadCatalog();
  await loadServiceDropdowns();
  alert('Saved to catalog.');
});

// ---- Sales & Takings ----
let serviceLines = [];
function renderLines(){
  const tbody = byId('service-lines').querySelector('tbody');
  tbody.innerHTML='';
  let gross=0, cogs=0;
  for (let i=0;i<serviceLines.length;i++){
    const L = serviceLines[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${L.name}</td><td>${L.qty}</td><td>${€(L.price)}</td>
      <td>${€(L.price * L.qty)}</td>
      <td>${€(L.cogs * L.qty)}</td>
      <td><button class="btn" data-i="${i}">Remove</button></td>`;
    tbody.appendChild(tr);
    gross += L.price*L.qty;
    cogs += L.cogs*L.qty;
  }
  setText(byId('services-gross'), €(gross));
  setText(byId('services-cogs'), €(cogs));
  tbody.querySelectorAll('button[data-i]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      serviceLines.splice(Number(btn.dataset.i),1);
      renderLines();
    });
  });
}
byId('add-service').addEventListener('click', async ()=>{
  const id = Number(byId('service-select').value);
  const qty = Number(byId('service-qty').value||1);
  const t = tx(db,['services'],'readonly'); const list = await getAll(t,'services');
  const s = list.find(x=>x.id===id);
  const vat = Number(byId('vat-rate').value||0.23);
  const priceIncl = s.price;
  const priceNet = priceIncl/(1+vat);
  const cogs = s.total; // catalog total cost (products + labour + utils + ops)
  serviceLines.push({id, name:s.name, qty, price:priceIncl, priceNet, cogs});
  renderLines();
});

byId('takings-mode').addEventListener('change', (e)=>{
  const week = e.target.value==='weekly';
  byId('week-label').classList.toggle('hidden', !week);
});

byId('post-takings').addEventListener('click', async ()=>{
  const mode = byId('takings-mode').value;
  const date = byId('takings-date').value;
  const weekEnd = byId('takings-week-end').value;
  const retailGross = Number(byId('retail-gross').value||0);
  const discounts = Number(byId('discounts').value||0);
  const voucherSales = Number(byId('voucher-sales').value||0);
  const voucherRedemptions = Number(byId('voucher-redemptions').value||0);
  const cash = Number(byId('cash').value||0);
  const card = Number(byId('card').value||0);
  const vatRate = Number(byId('vat-rate').value||0.23);

  // post takings entry
  const t = tx(db,['takings','journal'],'readwrite');
  const entry = {
    date: mode==='weekly' ? weekEnd : date,
    mode, retailGross, discounts, voucherSales, voucherRedemptions, cash, card,
    serviceLines
  };
  await add(t,'takings', entry);
  // journal (very simplified, double-entry shape omitted for brevity)
  // We store summary lines; reports will aggregate.
  await add(t,'journal', {
    date: entry.date, type:'takings',
    servicesGross: serviceLines.reduce((a,l)=>a+l.price*l.qty,0),
    servicesVat: serviceLines.reduce((a,l)=>a+(l.price/(1+vatRate)*vatRate*l.qty),0),
    retailGross, discounts, voucherSales, voucherRedemptions,
    cash, card,
    cogs: serviceLines.reduce((a,l)=>a+l.cogs*l.qty,0)
  });
  serviceLines = [];
  renderLines();
  byId('takings-status').textContent = 'Posted.';
  setTimeout(()=>byId('takings-status').textContent='', 1500);
});

// ---- Expenses ----
async function loadExpenseCats(){
  const t = tx(db,['expenseCats'],'readonly');
  const cats = await getAll(t,'expenseCats');
  const sel = byId('exp-category');
  sel.innerHTML='';
  for (const c of cats){
    const opt=document.createElement('option'); opt.value=c.name; opt.textContent=c.name; sel.appendChild(opt);
  }
}
byId('post-expense').addEventListener('click', async ()=>{
  const date = byId('exp-date').value;
  const supplier = byId('exp-supplier').value;
  const cat = byId('exp-category').value;
  const net = Number(byId('exp-net').value||0);
  const rate = Number(byId('exp-vat-rate').value||0);
  const vat = net*rate;
  const total = net+vat;
  const t = tx(db,['expenses','journal'],'readwrite');
  await add(t,'expenses',{date,supplier,cat,net,vat,total});
  await add(t,'journal',{date,type:'expense', net, vat, total, cat, supplier});
  byId('exp-status').textContent='Posted.';
  setTimeout(()=>byId('exp-status').textContent='',1500);
  renderExpensesTable();
});
async function renderExpensesTable(){
  const t = tx(db,['expenses'],'readonly'); const rows = await getAll(t,'expenses');
  const tbody = byId('exp-table').querySelector('tbody');
  tbody.innerHTML='';
  for (const r of rows.slice(-20).reverse()){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.date||''}</td><td>${r.supplier||''}</td><td>${r.cat||''}</td><td>${€(r.net)}</td><td>${€(r.vat)}</td><td>${€(r.total)}</td>`;
    tbody.appendChild(tr);
  }
}

// ---- Reports & Close Month ----
byId('run-reports').addEventListener('click', async ()=>{
  const from = byId('rep-from').value;
  const to = byId('rep-to').value;
  const t = tx(db,['journal'],'readonly');
  const all = await getAll(t,'journal');
  const rows = all.filter(r=>(!from || r.date>=from) && (!to || r.date<=to));
  let sales=0, cogs=0, exp=0, vatOut=0, vatIn=0, discounts=0;
  const vatRate = Number(byId('vat-rate').value||0.23);
  for (const r of rows){
    if (r.type==='takings'){
      sales += Number(r.servicesGross||0) + Number(r.retailGross||0) - Number(r.discounts||0);
      cogs += Number(r.cogs||0);
      discounts += Number(r.discounts||0);
      vatOut += Number(r.servicesVat||0); // simplistic
    } else if (r.type==='expense'){
      exp += Number(r.net||0);
      vatIn += Number(r.vat||0);
    } else if (r.type==='cogs-summary'){
      cogs += Number(r.cogs||0);
    }
  }
  const grossProfit = sales - cogs;
  const operating = grossProfit - exp;
  const vatDue = vatOut - vatIn;
  const out = byId('reports-output');
  out.innerHTML = `
    <div class="card">
      <h3>Summary</h3>
      <p>Sales: <b>${€(sales)}</b></p>
      <p>COGS: <b>${€(cogs)}</b></p>
      <p>Gross Profit: <b>${€(grossProfit)}</b></p>
      <p>Expenses: <b>${€(exp)}</b></p>
      <p>Operating Profit: <b>${€(operating)}</b></p>
      <p>VAT Due: <b>${€(vatDue)}</b></p>
      <p>Discounts: <b>${€(discounts)}</b></p>
    </div>
  `;
});

byId('close-month-btn').addEventListener('click', async ()=>{
  const period = byId('close-month').value; // YYYY-MM
  if (!period) { alert('Choose a month'); return; }
  // lock check
  const t0 = tx(db,['locks'],'readonly');
  const locked = await t0.objectStore('locks').get(period);
  if (locked){ byId('close-status').textContent = 'Already closed.'; return; }
  // compute summary COGS for month from takings with lines
  const t = tx(db,['journal','locks'],'readwrite');
  const all = await getAll(t,'journal');
  const rows = all.filter(r=> r.type==='takings' && r.date && r.date.startsWith(period));
  const cogs = rows.reduce((a,r)=>a+(Number(r.cogs||0)),0);
  await add(t,'journal',{date: period+'-28', type:'cogs-summary', cogs}); // date approx
  await add(t,'locks',{period});
  byId('close-status').textContent = 'Month closed & COGS summary posted.';
  setTimeout(()=>byId('close-status').textContent='',2000);
});

// ---- Sales helpers ----
async function populateInitial(){
  await loadCatalog();
  await loadServiceDropdowns();
  await loadExpenseCats();
  await renderExpensesTable();
  await loadSettingsForm();
  await renderSKUs();
  // default dates
  const today = new Date().toISOString().slice(0,10);
  byId('takings-date').value = today;
  byId('exp-date').value = today;
  byId('rep-from').value = today.slice(0,8)+'01';
  byId('rep-to').value = today;
}

// Export/Import
byId('export-json').addEventListener('click', async ()=>{
  const stores = ['settings','services','journal','takings','expenses','expenseCats','materials','usage','locks'];
  const dump = {};
  for (const s of stores){
    const t = tx(db,[s],'readonly'); dump[s] = await getAll(t,s);
  }
  const blob = new Blob([JSON.stringify(dump,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'salon-accounts-backup.json';
  a.click();
});
byId('import-json').addEventListener('change', async (e)=>{
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  const stores = Object.keys(data);
  const t = tx(db, stores, 'readwrite');
  for (const s of stores){
    for (const row of data[s]) await add(t,s,row);
  }
  alert('Imported.');
  populateInitial();
});

// Init
initTabs();
await initDB();
populateInitial();
