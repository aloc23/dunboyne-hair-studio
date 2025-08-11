
function money(n){ return `€${(n||0).toFixed(2)}`; }
function parseDateInput(el){
  if (el.value) return el.value;
  // fallback: if user typed
  return el.placeholder && /^\d{4}-\d{2}-\d{2}$/.test(el.placeholder) ? el.placeholder : new Date().toISOString().slice(0,10);
}

// VAT helpers
function splitVAT(amountIncl, ratePct){
  const rate = (ratePct||0)/100;
  const net = amountIncl/(1+rate);
  return { net, vat: amountIncl - net };
}
function addVAT(amountNet, ratePct){
  const rate = (ratePct||0)/100;
  const vat = amountNet*rate;
  return { gross: amountNet + vat, vat };
}

async function refreshServiceDropdowns(){
  const services = await Store.listServices();
  const selects = [document.getElementById('service-select'), document.getElementById('ca-service-select')];
  for (const sel of selects){
    sel.innerHTML = "";
    services.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      sel.appendChild(opt);
    });
  }
}

// Accounting tab logic
let serviceLines = []; // {name, qty, price, cogsUnit}
async function recalcTakingsKPIs(){
  const vatMode = document.getElementById('vat-mode').value;
  const vatRate = parseFloat(document.getElementById('vat-rate').value||"0");
  const servicesGross = parseFloat(document.getElementById('services-gross').value||"0");
  const retailGross = parseFloat(document.getElementById('retail-gross').value||"0");

  // If service lines exist, compute services gross from lines
  let linesGross = 0, cogs = 0;
  for (const l of serviceLines){
    linesGross += l.price * l.qty;
    cogs += l.cogsUnit * l.qty;
  }
  const finalServicesGross = serviceLines.length? linesGross : servicesGross;

  let netSales=0, vatAmount=0, servicesNet=0, retailNet=0;
  if (vatMode==="include"){
    const s = splitVAT(finalServicesGross, vatRate);
    servicesNet = s.net;
    vatAmount += s.vat;
    const r = splitVAT(retailGross, vatRate);
    retailNet = r.net; vatAmount += r.vat;
  }else{
    servicesNet = finalServicesGross;
    retailNet = retailGross;
    vatAmount = (finalServicesGross+retailGross) * (vatRate/100);
  }
  netSales = servicesNet + retailNet;
  document.getElementById('kpi-net').textContent = money(netSales);
  document.getElementById('kpi-vat').textContent = money(vatAmount);
  document.getElementById('kpi-cogs').textContent = money(cogs);
  return { netSales, vatAmount, servicesNet, retailNet, cogs };
}

async function addServiceLine(){
  const sel = document.getElementById('service-select');
  const qty = parseInt(document.getElementById('service-qty').value||"1");
  const name = sel.value; if (!name) return;
  const all = await Store.listServices();
  const svc = all.find(s=>s.name===name);
  if (!svc) return;
  const row = { name, qty, price: Number(svc.price||0), cogsUnit: Number(svc.total||0) };
  serviceLines.push(row);
  renderServiceLines();
  recalcTakingsKPIs();
}
function removeServiceLine(idx){
  serviceLines.splice(idx,1);
  renderServiceLines();
  recalcTakingsKPIs();
}
function renderServiceLines(){
  const tb = document.querySelector('#service-lines tbody');
  tb.innerHTML = "";
  serviceLines.forEach((l,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${l.name}</td>
      <td><input type="number" min="1" value="${l.qty}" data-i="${i}" class="qty"></td>
      <td>${money(l.price)}</td><td>${money(l.price*l.qty)}</td>
      <td>${money(l.cogsUnit)}</td><td>${money(l.cogsUnit*l.qty)}</td>
      <td><button class="btn danger" data-i="${i}">Remove</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('input.qty').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const i = Number(e.target.dataset.i);
      serviceLines[i].qty = Number(e.target.value||1);
      renderServiceLines();
      recalcTakingsKPIs();
    });
  });
  tb.querySelectorAll('button.btn.danger').forEach(btn=>{
    btn.addEventListener('click', e=> removeServiceLine(Number(btn.dataset.i)));
  });
}

async function postTakings(){
  const mode = document.getElementById('takings-mode').value;
  const date = mode==="weekly" ? parseDateInput(document.getElementById('takings-week')) : parseDateInput(document.getElementById('takings-date'));
  const cash = Number(document.getElementById('cash').value||0);
  const card = Number(document.getElementById('card').value||0);
  const servicesGross = Number(document.getElementById('services-gross').value||0);
  const retailGross = Number(document.getElementById('retail-gross').value||0);
  const kp = await recalcTakingsKPIs();
  const t = {
    date, mode,
    cash, card,
    servicesGross, retailGross,
    serviceLines,
    netSales: kp.netSales,
    vatAmount: kp.vatAmount,
    servicesNet: kp.servicesNet,
    retailNet: kp.retailNet,
    cogs: kp.cogs
  };
  await Store.postTakings(t);
  document.getElementById('acc-msg').textContent = "Takings posted.";
  // reset
  serviceLines = []; renderServiceLines();
  ['services-gross','retail-gross','cash','card'].forEach(id=>document.getElementById(id).value="");
  recalcTakingsKPIs();
}

// Expenses
function expRecalc(){
  const net = Number(document.getElementById('exp-net').value||0);
  const vatP = Number(document.getElementById('exp-vat').value||0);
  const vat = net * (vatP/100);
  document.getElementById('exp-total').value = (net+vat).toFixed(2);
}
async function postExpense(){
  const exp = {
    date: parseDateInput(document.getElementById('exp-date')),
    supplier: document.getElementById('exp-supplier').value || "(supplier)",
    category: document.getElementById('exp-category').value || "(category)",
    net: Number(document.getElementById('exp-net').value||0),
    vatPct: Number(document.getElementById('exp-vat').value||0),
  };
  exp.vat = exp.net*(exp.vatPct/100);
  exp.total = exp.net + exp.vat;
  await Store.postExpense(exp);
  document.getElementById('exp-msg').textContent = "Expense posted.";
  loadExpenses();
}
async function loadExpenses(){
  const list = await Store.listExpenses();
  const tb = document.querySelector('#expenses-table tbody');
  tb.innerHTML = "";
  list.slice(0,25).forEach(e=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.date}</td><td>${e.supplier}</td><td>${e.category}</td>
      <td>${money(e.net)}</td><td>${money(e.vat)}</td><td>${money(e.total)}</td>`;
    tb.appendChild(tr);
  });
}

// Cost Analyzer
let currentCA = null;
async function caLoad(){
  const name = document.getElementById('ca-service-select').value;
  const all = await Store.listServices();
  const svc = all.find(s=>s.name===name);
  if (!svc){ currentCA = null; return; }
  currentCA = structuredClone(svc);
  document.getElementById('ca-price').value = svc.price;
  document.getElementById('ca-mins').value = svc.mins;
  document.getElementById('ca-utilsHr').value = svc.utilsHr;
  document.getElementById('ca-supplies').value = svc.supplies;
  document.getElementById('ca-labour').value = svc.labour;
  document.getElementById('ca-ops').value = 0;
  caRecalc();
}
function caRecalc(){
  const price = Number(document.getElementById('ca-price').value||0);
  const mins = Number(document.getElementById('ca-mins').value||0);
  const utilsHr = Number(document.getElementById('ca-utilsHr').value||0);
  const supplies = Number(document.getElementById('ca-supplies').value||0);
  const labour = Number(document.getElementById('ca-labour').value||0);
  const ops = Number(document.getElementById('ca-ops').value||0);
  const utilsCost = mins * (utilsHr/60);
  const total = supplies + labour + ops + utilsCost;
  const margin = price - total;
  const marginPct = price>0 ? (margin/price)*100 : 0;
  const suggest = total/(1-0.65); // 65% GM target

  document.getElementById('rv-utils').textContent = money(utilsCost);
  document.getElementById('rv-supplies').textContent = money(supplies);
  document.getElementById('rv-labour').textContent = money(labour);
  document.getElementById('rv-ops').textContent = money(ops);
  document.getElementById('rv-total').textContent = money(total);
  document.getElementById('rv-margin').textContent = money(margin);
  document.getElementById('rv-marginPct').textContent = `${marginPct.toFixed(1)}%`;
  document.getElementById('rv-suggest').textContent = money(suggest);
}
async function caSaveToCatalog(){
  if (!currentCA){ document.getElementById('ca-msg').textContent = "Select a service first."; return; }
  currentCA.price = Number(document.getElementById('ca-price').value||0);
  currentCA.mins = Number(document.getElementById('ca-mins').value||0);
  currentCA.utilsHr = Number(document.getElementById('ca-utilsHr').value||0);
  currentCA.supplies = Number(document.getElementById('ca-supplies').value||0);
  currentCA.labour = Number(document.getElementById('ca-labour').value||0);
  const ops = Number(document.getElementById('ca-ops').value||0);
  // store total as computed (supplies+labour+ops+utilsCost @ current mins)
  const utilsCost = currentCA.mins * (currentCA.utilsHr/60);
  currentCA.total = currentCA.supplies + currentCA.labour + ops + utilsCost;
  await Store.upsertService(currentCA);
  document.getElementById('ca-msg').textContent = "Saved to catalog.";
  loadCatalog();
  refreshServiceDropdowns();
}

// Catalog
async function loadCatalog(){
  const list = await Store.listServices();
  const tb = document.querySelector('#catalog-table tbody');
  tb.innerHTML = "";
  list.sort((a,b)=>a.name.localeCompare(b.name));
  list.forEach(s=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.name}</td>
      <td>${money(Number(s.price||0))}</td>
      <td>${s.mins||0}</td>
      <td>${money(Number(s.supplies||0))}</td>
      <td>${Number(s.utilsHr||0).toFixed(2)}</td>
      <td>${money(Number(s.labour||0))}</td>
      <td>${money(Number(s.total||0))}</td>
      <td><button class="btn danger" data-name="${s.name}">Delete</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('button.danger').forEach(b=> b.addEventListener('click', async (e)=>{
    await Store.deleteService(e.target.dataset.name);
    loadCatalog(); refreshServiceDropdowns();
  }));
}

async function saveServiceFromForm(){
  const svc = {
    name: document.getElementById('svc-name').value.trim(),
    price: Number(document.getElementById('svc-price').value||0),
    mins: Number(document.getElementById('svc-mins').value||0),
    supplies: Number(document.getElementById('svc-supplies').value||0),
    utilsHr: Number(document.getElementById('svc-utilsHr').value||0),
    labour: Number(document.getElementById('svc-labour').value||0),
    total: Number(document.getElementById('svc-total').value||0),
  };
  if (!svc.name){ document.getElementById('cat-msg').textContent="Name required."; return; }
  await Store.upsertService(svc);
  document.getElementById('cat-msg').textContent="Service saved.";
  loadCatalog(); refreshServiceDropdowns();
}

// Reports
async function runReports(){
  const from = parseDateInput(document.getElementById('rep-from'));
  const to = parseDateInput(document.getElementById('rep-to'));
  const r = await Store.runReports(from, to);
  // Monthly one-pager
  const mtb = document.querySelector('#monthly-table tbody'); mtb.innerHTML="";
  const rows = [
    ["Revenue", money(r.totals.revenue)],
    ["COGS", money(r.totals.cogs)],
    ["Gross Profit", money(r.totals.gross)],
    ["Expenses", money(r.totals.expenses)],
    ["Operating Profit", money(r.totals.op)]
  ];
  for (const [k,v] of rows){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${k}</td><td>${v}</td>`; mtb.appendChild(tr);}

  // P&L
  const plb = document.querySelector('#pl-table tbody'); plb.innerHTML="";
  r.pl.forEach?null:null;
  for (const [k,v] of r.pl){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${k}</td><td>${money(v)}</td>`; plb.appendChild(tr); }

  // BS
  const bsb = document.querySelector('#bs-table tbody'); bsb.innerHTML="";
  for (const [k,v] of r.bs){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${k}</td><td>${money(v)}</td>`; bsb.appendChild(tr); }

  // VAT
  const vtb = document.querySelector('#vat-table tbody'); vtb.innerHTML="";
  for (const [k,v] of r.vat){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${k}</td><td>${money(v)}</td>`; vtb.appendChild(tr); }
}

// Settings
async function loadSettings(){
  const vat = await Store.settingsGet("vatRate"); if (vat!==undefined) document.getElementById('set-vat').value=vat;
  const mode = await Store.settingsGet("vatMode"); if (mode) document.getElementById('set-vat-mode').value=mode;
  const utils = await Store.settingsGet("utilsPerHour");
  if (utils!==undefined) document.getElementById('utils-total').value = utils;
  const list = await Store.listUtils();
  const tb = document.querySelector('#utils-table tbody'); tb.innerHTML="";
  list.forEach(u=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.name}</td><td>${money(u.monthly)}</td><td>${money(u.yearly)}</td><td>${money(u.perHr)}</td>`;
    tb.appendChild(tr);
  });
}
async function saveSettings(){
  const vat = Number(document.getElementById('set-vat').value||23);
  const mode = document.getElementById('set-vat-mode').value;
  const utils = Number(document.getElementById('utils-total').value||21.27);
  await Store.settingsSet("vatRate", vat);
  await Store.settingsSet("vatMode", mode);
  await Store.settingsSet("utilsPerHour", utils);
  document.getElementById('set-msg').textContent = "Settings saved.";
  // push into accounting VAT controls too
  document.getElementById('vat-rate').value = vat;
  document.getElementById('vat-mode').value = mode;
}

// Tab nav
function activate(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
}

// Price list print
async function exportPriceList(){
  const list = await Store.listServices();
  const win = window.open("", "_blank");
  const rows = list.sort((a,b)=>a.name.localeCompare(b.name)).map(s=>`
    <tr><td>${s.name}</td><td>€${Number(s.price||0).toFixed(2)}</td><td>${s.mins||0} mins</td></tr>
  `).join("");
  win.document.write(`<!DOCTYPE html><html><head><title>Price List</title>
  <style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}</style>
  </head><body><h2>Price List</h2><table><thead><tr><th>Service</th><th>Price</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}

async function init(){
  await seedIfEmpty();
  activate('accounting');
  await refreshServiceDropdowns();
  await loadCatalog();
  await loadSettings();
  await loadExpenses();

  // bind tab buttons
  document.querySelectorAll('.tab-btn').forEach(b=> b.addEventListener('click', ()=> activate(b.dataset.tab)));

  // Accounting
  document.getElementById('takings-mode').addEventListener('change', e=>{
    document.getElementById('week-range').style.display = e.target.value==="weekly" ? "" : "none";
    document.getElementById('date-label').textContent = e.target.value==="weekly" ? "Week Starting" : "Date";
  });
  ['services-gross','retail-gross','vat-rate','vat-mode'].forEach(id=>{
    document.getElementById(id).addEventListener('input', recalcTakingsKPIs);
    document.getElementById(id).addEventListener('change', recalcTakingsKPIs);
  });
  document.getElementById('add-service-line').addEventListener('click', addServiceLine);
  document.getElementById('post-takings').addEventListener('click', postTakings);
  recalcTakingsKPIs();

  // Expenses
  document.getElementById('exp-net').addEventListener('input', expRecalc);
  document.getElementById('exp-vat').addEventListener('input', expRecalc);
  expRecalc();
  document.getElementById('post-expense').addEventListener('click', postExpense);

  // Cost Analyzer
  document.getElementById('ca-load').addEventListener('click', caLoad);
  document.getElementById('ca-recalc').addEventListener('click', caRecalc);
  document.getElementById('ca-add-to-catalog').addEventListener('click', caSaveToCatalog);

  // Catalog
  document.getElementById('svc-save').addEventListener('click', saveServiceFromForm);
  document.getElementById('export-price-list').addEventListener('click', exportPriceList);

  // Reports
  document.getElementById('run-reports').addEventListener('click', runReports);

  // Settings
  document.getElementById('save-settings').addEventListener('click', saveSettings);
}

window.addEventListener('load', init);
