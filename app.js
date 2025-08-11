
function byId(id){ return document.getElementById(id); }
function initTabs(){
  const nav = byId('tabs');
  nav.addEventListener('click', (e)=>{
    if(e.target.tagName!=='BUTTON') return;
    const t = e.target.getAttribute('data-tab');
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('.tab').forEach(sec=>sec.classList.remove('active'));
    byId(t).classList.add('active');
  });
}
async function loadSettings(){
  const s = await DB.kvGet('settings') || { vat:23, vatMode:'include' };
  byId('set-vat').value = s.vat ?? 23;
  byId('set-vatmode').value = s.vatMode || 'include';
}
async function saveSettings(){
  const s = { vat: Number(byId('set-vat').value||23), vatMode: byId('set-vatmode').value };
  await DB.kvSet('settings', s);
  alert('Saved');
}
function seed(){
  const today = new Date().toISOString().slice(0,10);
  byId('tak-date').value = today;
  byId('exp-date').value = today;
  byId('rep-from').value = today.slice(0,7)+'-01';
  byId('rep-to').value = today;
}
function renderRecent(rows){
  const tbl = byId('recent-table');
  const headers = ['Date','Type','Memo','Lines'];
  const trs = rows.slice(-10).reverse().map(r=>{
    const line = r.lines.map(l=>`${l.account}: ${ (l.debit?'+':'-') }${(l.debit||l.credit).toFixed(2)}`).join('<br>');
    return `<tr><td>${r.date}</td><td>${r.source}</td><td>${r.memo}</td><td>${line}</td></tr>`;
  });
  tbl.innerHTML = `<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>${trs.join('')}`;
}
async function refreshRecent(){
  const j = await DB.all('journal');
  renderRecent(j);
}
function setupTakings(){
  byId('takings-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const date = byId('tak-date').value;
    const note = byId('tak-note').value;
    const servicesGross = Number(byId('tak-services').value||0);
    const retailGross = Number(byId('tak-retail').value||0);
    const refundsGross = Number(byId('tak-refunds').value||0);
    const cash = Number(byId('tak-cash').value||0);
    const card = Number(byId('tak-card').value||0);
    const vouchersIn = Number(byId('tak-vouchers-in').value||0);
    const vouchersOut = Number(byId('tak-vouchers-out').value||0);
    const vatMode = byId('tak-vatmode').value;
    const s = await DB.kvGet('settings') || { vat:23 };
    const vatRate = s.vat || 23;
    await Ledger.postTakings({date, servicesGross, retailGross, refundsGross, cash, card, vouchersIn, vouchersOut, vatRate, vatMode, note});
    await refreshRecent();
    alert('Takings posted');
  });
}
function setupExpense(){
  byId('expense-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const date = byId('exp-date').value;
    const supplier = byId('exp-supplier').value;
    const category = byId('exp-category').value;
    const net = Number(byId('exp-net').value||0);
    const vatRate = Number(byId('exp-vatrate').value||0);
    const total = Number(byId('exp-total').value||0);
    await Ledger.postExpense({date, supplier, category, net, vatRate, total});
    await refreshRecent();
    alert('Expense posted');
  });
}
function setupReports(){
  byId('btn-run').addEventListener('click', async ()=>{
    const from = byId('rep-from').value, to = byId('rep-to').value;
    const j = await Ledger.journalBetween(from,to);
    const balances = Reports.computeBalances(j);
    const pl = Reports.plFrom(balances);
    const bs = Reports.bsFrom(balances);
    const vat = Reports.vatSummary(j);
    const plRows = { headers:['Name','Amount'],
      rows:[ ['Sales (total)', pl.salesTotal], ['Refunds', pl.refundsTotal], ['Expenses', pl.expenseTotal], ['Gross Profit', pl.grossProfit] ] };
    Reports.renderTable(document.getElementById('pl-table'), plRows);
    const bsRows = { headers:['Section','Amount'],
      rows:[ ['Assets total', bs.assetsTotal], ['Liabilities total', bs.liabsTotal], ['Equity total', bs.equityTotal] ] };
    Reports.renderTable(document.getElementById('bs-table'), bsRows);
    const vatRows = { headers:['Output VAT','Input VAT','Due'], rows:[[vat.output, vat.input, vat.due]] };
    Reports.renderTable(document.getElementById('vat-table'), vatRows);
  });
}
function setupCost(){
  const list = document.getElementById('materials-list');
  Cost.addMaterialRow(list);
  document.getElementById('add-material').addEventListener('click', ()=>Cost.addMaterialRow(list));
  document.getElementById('cost-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const mats = Array.from(list.querySelectorAll('.grid-3')).map(row=>{
      return { name: row.querySelector('.mat-name').value,
        units: Number(row.querySelector('.mat-units').value||0),
        cost: Number(row.querySelector('.mat-cost').value||0) };
    });
    const params = {
      service: document.getElementById('cost-service').value,
      target: Number(document.getElementById('cost-target').value||0),
      materials: mats,
      mins: Number(document.getElementById('labour-mins').value||0),
      rate: Number(document.getElementById('labour-rate').value||0),
      overhead: Number(document.getElementById('overhead').value||0),
      price: Number(document.getElementById('price-gross').value||0),
      vat: Number(document.getElementById('price-vat').value||0)
    };
    const out = Cost.computeCost(params);
    document.getElementById('cost-output').innerHTML = `
      Materials: €${out.materialsCost.toFixed(2)} | Labour: €${out.labour.toFixed(2)} | Overhead: €${out.overhead.toFixed(2)}<br>
      True Cost: €${out.trueCost.toFixed(2)} | Price (net): €${out.priceNet.toFixed(2)}<br>
      Margin: €${out.margin.toFixed(2)} (${out.marginPct.toFixed(1)}%)<br>
      Suggested Price (gross): €${out.recommendation.toFixed(2)}`;
    await Cost.saveAnalysis({ ...params, ...out });
    await refreshAnalyses();
  });
}
async function refreshAnalyses(){
  const rows = await DB.all('analyses');
  const tbl = document.getElementById('cost-table');
  const headers = ['Service','True Cost','Margin %','Suggested Gross'];
  const trs = rows.slice(-50).reverse().map(r=>{
    return `<tr><td>${r.service}</td><td>${r.trueCost.toFixed(2)}</td><td>${r.marginPct.toFixed(1)}</td><td>${r.recommendation.toFixed(2)}</td></tr>`;
  });
  tbl.innerHTML = `<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>${trs.join('')}`;
}
function setupImport(){
  const fileInput = document.getElementById('import-file');
  document.getElementById('btn-parse').addEventListener('click', async ()=>{
    const f = fileInput.files?.[0];
    if(!f) return alert('Choose a CSV file first');
    const text = await f.text();
    const rows = Importer.parseCSV(text);
    Importer.IMPORT_ROWS = rows;
    Importer.previewImport(rows, document.getElementById('import-preview'));
  });
  document.getElementById('btn-apply').addEventListener('click', async ()=>{
    if(!Importer.IMPORT_ROWS.length) return alert('Parse a file first');
    await Importer.applyImport(Importer.IMPORT_ROWS);
    alert('Applied');
  });
}
function setupData(){
  document.getElementById('btn-export').addEventListener('click', async ()=>{
    const dump = {};
    for(const s of ['settings','journal','takings','expenses','services','materials','service_materials','analyses']){
      dump[s] = await DB.all(s);
    }
    const blob = new Blob([JSON.stringify(dump,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='salon-data.json'; a.click();
    URL.revokeObjectURL(url);
    document.getElementById('export-status').textContent = 'Exported salon-data.json';
  });
  document.getElementById('btn-restore').addEventListener('click', async ()=>{
    const f = document.getElementById('restore-file').files?.[0];
    if(!f) return alert('Choose a JSON file first');
    const text = await f.text();
    const dump = JSON.parse(text);
    for(const s of ['settings','journal','takings','expenses','services','materials','service_materials','analyses']){
      await DB.clear(s);
      for(const row of dump[s]||[]) await DB.add(s,row);
    }
    alert('Restored');
  });
}
async function main(){
  initTabs();
  seed();
  await loadSettings();
  document.getElementById('btn-save-settings').addEventListener('click', (e)=>{ e.preventDefault(); saveSettings(); });
  setupTakings();
  setupExpense();
  setupReports();
  setupCost();
  setupImport();
  setupData();
  await refreshRecent();
  await refreshAnalyses();
}
document.addEventListener('DOMContentLoaded', main);
