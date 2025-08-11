
// Tab logic
document.querySelectorAll('#tabs .tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#tabs .tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabpane').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

// Settings init
const settings = getSettings();
document.getElementById('vat-mode').value = settings.vatMode || 'include';
document.getElementById('vat-rate').value = settings.vatRate ?? 23;

// Utilities table
function renderUtilities(){
  const tbody = document.querySelector('#utilities-table tbody');
  const s = getSettings();
  tbody.innerHTML = '';
  s.utilities.forEach((u,idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${u.name}"/></td>
      <td><input type="number" step="0.01" value="${u.perMonth.toFixed(2)}"/></td>
      <td><button class="btn" data-idx="${idx}">✕</button></td>`;
    tbody.appendChild(tr);
    tr.querySelectorAll('input')[0].addEventListener('change', (e)=>{ u.name = e.target.value; saveSettings(s); calcUtilPerHour(); });
    tr.querySelectorAll('input')[1].addEventListener('change', (e)=>{ u.perMonth = +e.target.value; saveSettings(s); calcUtilPerHour(); });
    tr.querySelector('button').addEventListener('click',()=>{ s.utilities.splice(idx,1); saveSettings(s); renderUtilities(); calcUtilPerHour(); });
  });
}
function calcUtilPerHour(){
  const s = getSettings();
  const perMonth = s.utilities.reduce((a,u)=>a+(u.perMonth||0),0);
  // approx hours open per month (assume 182 hours ~ 42h/week * 4.33)
  const eurHr = perMonth / 182;
  document.getElementById('util-eur-hr').textContent = eurHr.toFixed(2);
  return eurHr;
}
document.getElementById('add-utility').addEventListener('click', ()=>{
  const s = getSettings();
  s.utilities.push({name:'Utility', perMonth:0});
  saveSettings(s);
  renderUtilities(); calcUtilPerHour();
});
renderUtilities(); calcUtilPerHour();

// Expense categories
function renderCats(){
  const s = getSettings();
  const ul = document.getElementById('cat-list');
  ul.innerHTML = '';
  s.categories.forEach((c,i)=>{
    const li = document.createElement('li'); li.textContent = c; ul.appendChild(li);
  });
  // populate dropdown
  const sel = document.getElementById('exp-category');
  sel.innerHTML = s.categories.map(c=>`<option>${c}</option>`).join('');
}
renderCats();
document.getElementById('add-cat').addEventListener('click',()=>{
  const s = getSettings();
  const val = document.getElementById('new-cat').value.trim();
  if(val){ s.categories.push(val); saveSettings(s); renderCats(); document.getElementById('new-cat').value=''; }
});

// Catalog
function renderCatalog(){
  const tbody = document.querySelector('#catalog-table tbody');
  const catalog = getCatalog();
  tbody.innerHTML = '';
  catalog.forEach(svc=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${svc.name}"/></td>
      <td><input type="number" step="0.01" value="${svc.price.toFixed(2)}"/></td>
      <td><input type="number" step="1" value="${svc.mins}"/></td>
      <td><input type="number" step="0.01" value="${svc.products.toFixed(2)}"/></td>
      <td><input type="number" step="0.01" value="${svc.utilities.toFixed(2)}"/></td>
      <td><input type="number" step="0.01" value="${svc.labour.toFixed(2)}"/></td>
      <td>${svc.totalCost.toFixed(2)}</td>
      <td><button class="btn" data-id="${svc.id}">Delete</button></td>
    `;
    tbody.appendChild(tr);
    const inputs = tr.querySelectorAll('input');
    const update = ()=>{
      const [name, price, mins, products, utilities, labour] = Array.from(inputs).map(i=>i.type==='number'?+i.value:i.value);
      upsertService({...svc, name, price, mins, products, utilities, labour});
      renderCatalog();
      renderServiceLines(); // refresh dropdowns
    };
    inputs.forEach(inp=> inp.addEventListener('change', update));
    tr.querySelector('button').addEventListener('click',()=>{ deleteService(svc.id); renderCatalog(); renderServiceLines(); });
  });
}
document.getElementById('add-service').addEventListener('click',()=>{
  upsertService({name:'New Service', price:0, mins:30, products:0, utilities:0, labour:0});
  renderCatalog(); renderServiceLines();
});
document.getElementById('export-price-list').addEventListener('click',()=>{
  const w = window.open('', '_blank');
  const catalog = getCatalog();
  w.document.write('<h2>Price List</h2><table border="1" cellpadding="6" cellspacing="0"><tr><th>Service</th><th>Price</th><th>Duration</th></tr>');
  catalog.forEach(s=> w.document.write(`<tr><td>${s.name}</td><td>€ ${s.price.toFixed(2)}</td><td>${s.mins} mins</td></tr>`));
  w.document.write('</table>');
  w.document.close(); w.focus(); w.print();
});
renderCatalog();

// Takings: service lines
function newLineRow(){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><select class="svc"></select></td>
    <td><input type="number" class="qty" min="1" step="1" value="1"/></td>
    <td><input type="number" class="price" step="0.01"/></td>
    <td><input type="number" class="disc" step="0.01" value="0"/></td>
    <td><input type="number" class="vouch" step="0.01" value="0"/></td>
    <td class="linetotal">0.00</td>
    <td><button class="btn">✕</button></td>
  `;
  // populate service options
  const sel = tr.querySelector('.svc');
  const catalog = getCatalog();
  sel.innerHTML = catalog.map(s=>`<option value="${s.id}" data-price="${s.price}">${s.name}</option>`).join('');
  // default price to catalog
  const priceInput = tr.querySelector('.price');
  const qtyInput = tr.querySelector('.qty');
  const discInput = tr.querySelector('.disc');
  const vouchInput = tr.querySelector('.vouch');
  function recalc(){
    const qty = +qtyInput.value || 0;
    const price = +priceInput.value || 0;
    const disc = +discInput.value || 0;
    const vouch = +vouchInput.value || 0;
    const gross = (price*qty) - disc - vouch;
    tr.querySelector('.linetotal').textContent = (gross>0?gross:0).toFixed(2);
    renderKPIs();
  }
  sel.addEventListener('change', ()=>{
    const opt = sel.selectedOptions[0];
    priceInput.value = (+opt.dataset.price).toFixed(2);
    recalc();
  });
  [priceInput, qtyInput, discInput, vouchInput].forEach(i=> i.addEventListener('input', recalc));
  tr.querySelector('button').addEventListener('click',()=>{ tr.remove(); renderKPIs(); });
  // init price
  const first = catalog[0];
  if(first){ priceInput.value = first.price.toFixed(2); }
  return tr;
}

function renderServiceLines(){
  const tbody = document.querySelector('#service-lines tbody');
  if(tbody.children.length===0){
    tbody.appendChild(newLineRow());
  }else{
    // update options on existing rows
    tbody.querySelectorAll('tr').forEach(tr=>{
      const sel = tr.querySelector('.svc');
      const selected = sel.value;
      const catalog = getCatalog();
      sel.innerHTML = catalog.map(s=>`<option value="${s.id}" data-price="${s.price}">${s.name}</option>`).join('');
      if([...sel.options].some(o=>o.value===selected)){
        sel.value = selected;
      }else if(catalog[0]){
        sel.value = catalog[0].id;
        tr.querySelector('.price').value = catalog[0].price.toFixed(2);
      }
    });
  }
  renderKPIs();
}
document.getElementById('add-line').addEventListener('click', ()=>{
  document.querySelector('#service-lines tbody').appendChild(newLineRow());
  renderKPIs();
});
renderServiceLines();

function renderKPIs(){
  const rows = Array.from(document.querySelectorAll('#service-lines tbody tr'));
  const lines = rows.map(tr=>{
    const serviceId = tr.querySelector('.svc').value;
    const qty = +tr.querySelector('.qty').value || 0;
    const unitPrice = +tr.querySelector('.price').value || 0;
    const discount = +tr.querySelector('.disc').value || 0;
    const voucher = +tr.querySelector('.vouch').value || 0;
    return {serviceId, qty, unitPrice, discount, voucher};
  });
  const retailGross = +document.getElementById('retail-gross').value || 0;
  const vatMode = document.getElementById('vat-mode').value;
  const vatRate = +document.getElementById('vat-rate').value || 23;
  const totals = computeSaleTotals(lines, retailGross, vatMode, vatRate);
  const cogs = computeCOGS(lines, getCatalog());
  const kpis = document.getElementById('takings-kpis');
  kpis.innerHTML = `
    <div class="chip">Svc Gross € ${totals.svcGross.toFixed(2)}</div>
    <div class="chip">Retail Gross € ${retailGross.toFixed(2)}</div>
    <div class="chip">Revenue Gross € ${totals.totalGross.toFixed(2)}</div>
    <div class="chip">VAT € ${totals.vat.toFixed(2)}</div>
    <div class="chip">COGS € ${cogs.toFixed(2)}</div>
    <div class="chip">Gross Profit € ${(totals.totalGross-cogs).toFixed(2)}</div>
  `;
}
['retail-gross','vat-mode','vat-rate','cash-in','card-in'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener('input', renderKPIs);
});

document.getElementById('post-takings').addEventListener('click', ()=>{
  const date = document.getElementById('takings-date').value;
  if(!date){ alert('Pick a date'); return; }
  const mode = document.getElementById('takings-mode').value;
  const vatMode = document.getElementById('vat-mode').value;
  const vatRate = +document.getElementById('vat-rate').value || 23;
  const rows = Array.from(document.querySelectorAll('#service-lines tbody tr'));
  const lines = rows.map(tr=>{
    const serviceId = tr.querySelector('.svc').value;
    const qty = +tr.querySelector('.qty').value || 0;
    const unitPrice = +tr.querySelector('.price').value || 0;
    const discount = +tr.querySelector('.disc').value || 0;
    const voucher = +tr.querySelector('.vouch').value || 0;
    return {serviceId, qty, unitPrice, discount, voucher};
  }).filter(l=>l.qty>0);
  const entry = {
    date, mode, vatMode, vatRate,
    lines,
    retailGross:+document.getElementById('retail-gross').value || 0,
    cash:+document.getElementById('cash-in').value || 0,
    card:+document.getElementById('card-in').value || 0
  };
  postTakings(entry);
  alert('Takings posted');
  // reset
  document.querySelector('#service-lines tbody').innerHTML='';
  renderServiceLines();
  document.getElementById('retail-gross').value='0';
  document.getElementById('cash-in').value='0';
  document.getElementById('card-in').value='0';
  renderKPIs();
});

document.getElementById('reset-takings').addEventListener('click', ()=>{
  document.querySelector('#service-lines tbody').innerHTML='';
  renderServiceLines(); renderKPIs();
});

// Expenses
document.getElementById('post-expense').addEventListener('click', ()=>{
  const date = document.getElementById('exp-date').value;
  const category = document.getElementById('exp-category').value;
  const supplier = document.getElementById('exp-supplier').value;
  const net = +document.getElementById('exp-net').value || 0;
  const vatRate = +document.getElementById('exp-vat-rate').value || 0;
  if(!date){ alert('Pick a date'); return; }
  if(net<=0){ alert('Enter net amount'); return; }
  postExpense({date, category, supplier, net, vatRate});
  renderExpenseList();
  alert('Expense posted');
});

function renderExpenseList(){
  const tbody = document.querySelector('#exp-list tbody');
  const exps = listExpenses();
  tbody.innerHTML = exps.slice(-20).reverse().map(e=>`<tr>
    <td>${e.date}</td><td>${e.category}</td><td>${e.supplier||''}</td>
    <td>${e.net.toFixed(2)}</td><td>${e.vat.toFixed(2)}</td><td>${e.total.toFixed(2)}</td>
  </tr>`).join('');
}
renderExpenseList();

// Reports
document.getElementById('run-reports').addEventListener('click', ()=>{
  const from = document.getElementById('rep-from').value || null;
  const to = document.getElementById('rep-to').value || null;
  renderReports(from, to);
});
document.getElementById('close-month-btn').addEventListener('click', ()=>{
  const ym = document.getElementById('close-month').value;
  if(!ym){ alert('Pick month'); return; }
  if(monthLocked(ym)){ alert('Month already locked'); return; }
  const cogs = closeMonthCOGS(ym);
  alert(`Posted COGS summary €${cogs.toFixed(2)} and locked ${ym}`);
});

// Sync VAT settings back
document.getElementById('vat-mode').addEventListener('change', e=>{
  const s = getSettings(); s.vatMode = e.target.value; saveSettings(s);
});
document.getElementById('vat-rate').addEventListener('change', e=>{
  const s = getSettings(); s.vatRate = +e.target.value || 23; saveSettings(s);
});
