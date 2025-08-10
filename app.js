
import { seedIfEmpty, getAll, add, put } from './db.js';
import { vatSplit, postTakings, postExpense, listJournal, reportPNL, reportBalanceSheet, reportVAT, reportCommission } from './ledger.js';
import { computeTrueCost, saveAnalysis, listAnalyses } from './cost_analyzer.js';

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
function money(n){ return '€' + (n||0).toFixed(2); }

async function init() {
  await seedIfEmpty();
  bindTabs();
  await loadSettingsUI();
  await loadStylistUI();
  bindAccounting();
  bindExpense();
  bindReports();
  bindData();
  bindCostAnalyzer();
  refreshKPIs();
  refreshJournal();
}

function bindTabs() {
  qsa('.tab').forEach(btn => btn.addEventListener('click', () => {
    qsa('.tab').forEach(b=>b.classList.remove('active'));
    qsa('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    qs('#tab-'+btn.dataset.tab).classList.add('active');
  }));
}

async function loadSettingsUI() {
  const settings = (await getAll('settings'))[0];
  qs('#setVatRate').value = settings.defaultVatRate || 23;
  qs('#globalVatMode').value = settings.vatMode || 'include';
  qs('#saveSettings').onclick = async () => {
    const s = (await getAll('settings'))[0];
    s.defaultVatRate = parseFloat(qs('#setVatRate').value);
    s.vatMode = qs('#globalVatMode').value;
    await put('settings', s);
    alert('Saved settings');
  };
}

async function loadStylistUI() {
  const stylists = await getAll('stylists');
  const sel = qs('#tkStylist');
  sel.innerHTML = stylists.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  // table
  const tbody = qs('#stylistTable tbody');
  tbody.innerHTML = stylists.map(s=>`<tr><td>${s.name}</td><td>${(s.commissionRate||0).toFixed(2)}</td></tr>`).join('');
  qs('#stylistForm').onsubmit = async (e) => {
    e.preventDefault();
    const rec = { name: qs('#styName').value, commissionRate: parseFloat(qs('#styRate').value||'0') };
    await add('stylists', rec);
    await loadStylistUI();
    e.target.reset();
  };
}

function bindAccounting() {
  qs('#takingsForm').onsubmit = async (e) => {
    e.preventDefault();
    const settings = (await getAll('settings'))[0];
    const tk = {
      date: qs('#tkDate').value || new Date().toISOString().slice(0,10),
      stylistId: parseInt(qs('#tkStylist').value||'0'),
      servicesGross: parseFloat(qs('#tkServicesGross').value||'0'),
      retailGross: parseFloat(qs('#tkRetailGross').value||'0'),
      vatRate: parseFloat(qs('#tkVatRate').value||settings.defaultVatRate||23),
      cash: parseFloat(qs('#tkCash').value||'0'),
      card: parseFloat(qs('#tkCard').value||'0'),
      vouchersIn: parseFloat(qs('#tkVouchersIn').value||'0'),
      vouchersOut: parseFloat(qs('#tkVouchersOut').value||'0'),
      refunds: parseFloat(qs('#tkRefunds').value||'0'),
      vatMode: qs('#globalVatMode').value || settings.vatMode || 'include'
    };
    await postTakings(tk);
    e.target.reset();
    await refreshKPIs();
    await refreshJournal();
    alert('Takings posted.');
  };
}

async function refreshKPIs() {
  // simple: sum takings for current month
  const now = new Date();
  const period = now.toISOString().slice(0,7);
  const pnl = await reportPNL(period);
  const vat = await reportVAT(period);
  qs('#kpiRevenueGross').textContent = money(Math.max(0, pnl.totalIncome)); // rough
  // We can calculate net revenue as income rows only
  const netIncome = pnl.rows.filter(r=>r.amount>0).reduce((a,b)=>a+b.amount,0);
  qs('#kpiRevenueNet').textContent = money(netIncome);
  qs('#kpiVatOut').textContent = money(vat.output);
  // expenses net is negative in pnl rows; show positive
  const totalExpense = -pnl.rows.filter(r=>r.amount<0).reduce((a,b)=>a+b.amount,0);
  qs('#kpiExpensesNet').textContent = money(totalExpense);
}

async function refreshJournal() {
  const rows = await listJournal(20);
  const tbody = qs('#journalTable tbody');
  tbody.innerHTML = rows.map(r=>{
    const lines = r.lines.map(l=>`${l.debit?'+':''}${money(l.debit||0)} / ${money(l.credit||0)}`).join('<br/>');
    return `<tr><td>${r.date}</td><td>${r.memo}</td><td>${lines}</td></tr>`;
  }).join('');
}

function bindExpense() {
  const exNet = qs('#exNet'); const exRate = qs('#exVatRate'); const exTotal = qs('#exTotal');
  function recalc(){ const net=parseFloat(exNet.value||'0'); const rate=parseFloat(exRate.value||'0'); exTotal.value=(net*(1+rate/100)).toFixed(2); }
  exNet.addEventListener('input', recalc); exRate.addEventListener('input', recalc);

  // categories from accounts (expense type)
  (async () => {
    const accounts = await getAll('accounts');
    const exp = accounts.filter(a=>a.type==='expense');
    qs('#exCategory').innerHTML = exp.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
  })();

  qs('#expenseForm').onsubmit = async (e) => {
    e.preventDefault();
    const ex = {
      date: qs('#exDate').value || new Date().toISOString().slice(0,10),
      supplier: qs('#exSupplier').value,
      categoryAccountId: parseInt(qs('#exCategory').value),
      net: parseFloat(qs('#exNet').value||'0'),
      vatRate: parseFloat(qs('#exVatRate').value||'0'),
      payMethod: 'bank'
    };
    await postExpense(ex);
    e.target.reset();
    await refreshKPIs();
    await refreshJournal();
    alert('Expense posted.');
  };
}

function bindReports() {
  qs('#repPeriod').value = new Date().toISOString().slice(0,7);
  qs('#runReports').onclick = async () => {
    const p = qs('#repPeriod').value;
    const pnl = await reportPNL(p);
    const bs  = await reportBalanceSheet(p);
    const vat = await reportVAT(p);
    const comm= await reportCommission(p);
    const pnlBody = qs('#pnlTable tbody');
    pnlBody.innerHTML = pnl.rows.map(r=>`<tr><td>${r.account}</td><td>${money(r.amount)}</td></tr>`).join('') +
      `<tr><th>Total Income</th><th>${money(pnl.totalIncome)}</th></tr>` +
      `<tr><th>Total Expenses</th><th>${money(pnl.totalExpense)}</th></tr>` +
      `<tr><th>Net Profit</th><th>${money(pnl.net)}</th></tr>`;
    const bsBody = qs('#bsTable tbody');
    bsBody.innerHTML = bs.map(r=>`<tr><td>${r.account}</td><td>${money(r.amount)}</td></tr>`).join('');
    const vatBody = qs('#vatTable tbody');
    vatBody.innerHTML = `<tr><td>Output VAT</td><td>${money(vat.output)}</td></tr>
                         <tr><td>Input VAT</td><td>${money(vat.input)}</td></tr>
                         <tr><th>VAT Due</th><th>${money(vat.net)}</th></tr>`;
    const commBody = qs('#commTable tbody');
    commBody.innerHTML = comm.map(c=>`<tr><td>${c.name}</td><td>${money(c.commission)}</td></tr>`).join('');
  };
}

function bindData() {
  qs('#exportJson').onclick = async () => {
    const stores = ['accounts','journal_entries','takings','expenses','services','materials','service_materials','stylists','operations','settings','analyses'];
    const out = {};
    for (const s of stores) out[s] = await getAll(s);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'salon-accounting-backup.json';
    a.click();
  };
  qs('#importJson').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const txt = await file.text();
    const data = JSON.parse(txt);
    // naive restore: clear and re-add
    alert('Import will replace current data on next version (for MVP manual merge). For now, please start fresh.');
  };
}

function bindCostAnalyzer() {
  const listDiv = document.getElementById('materialsList');
  function addMaterialRow() {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<input placeholder="Material name" class="matName"/>
                     <input type="number" step="0.001" placeholder="Units" class="matUnits" style="max-width:120px"/>
                     <input type="number" step="0.001" placeholder="€ per unit" class="matCost" style="max-width:140px"/>`;
    listDiv.appendChild(row);
  }
  document.getElementById('addMaterial').onclick = () => addMaterialRow();
  addMaterialRow(); // one by default

  document.getElementById('serviceForm').onsubmit = async (e) => {
    e.preventDefault();
    const mats = Array.from(document.querySelectorAll('#materialsList .row')).map(r => ({
      name: r.querySelector('.matName').value,
      units: parseFloat(r.querySelector('.matUnits').value||'0'),
      costPerUnit: parseFloat(r.querySelector('.matCost').value||'0'),
    }));
    const model = {
      name: document.getElementById('svcName').value,
      priceNet: parseFloat(document.getElementById('svcPriceNet').value||'0'),
      targetMargin: parseFloat(document.getElementById('svcTarget').value||'0'),
      mins: parseFloat(document.getElementById('svcMins').value||'0'),
      labourRate: parseFloat(document.getElementById('svcLabourRate').value||'0'),
      overheadPerService: parseFloat(document.getElementById('svcOverhead').value||'0'),
      materials: mats
    };
    const res = computeTrueCost(model);
    document.getElementById('costResult').innerHTML = `
      <div class="grid four">
        <div class="kpi"><div class="kpi-label">Materials</div><div class="kpi-value">€${res.materials.toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-label">Labour</div><div class="kpi-value">€${res.labour.toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-label">Overheads</div><div class="kpi-value">€${res.ops.toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-label">True Cost</div><div class="kpi-value">€${res.trueCost.toFixed(2)}</div></div>
      </div>
      <p><strong>Margin:</strong> ${res.marginPct.toFixed(1)}% (target ${model.targetMargin}%)</p>
      <p><em>Price suggestion to hit target:</em> €${ (res.trueCost / (1 - model.targetMargin/100)).toFixed(2) }</p>
    `;
    await saveAnalysis(model);
    await refreshAnalyses();
  };

  async function refreshAnalyses() {
    const rows = await listAnalyses();
    const tb = document.querySelector('#analysisTable tbody');
    tb.innerHTML = rows.map(r=>{
      const gap = (r.result.marginPct - r.targetMargin);
      return `<tr><td>${r.service}</td><td>€${r.priceNet.toFixed(2)}</td><td>€${r.result.trueCost.toFixed(2)}</td><td>${r.result.marginPct.toFixed(1)}%</td><td>${gap>=0?'+':''}${gap.toFixed(1)}%</td></tr>`;
    }).join('');
  }
  refreshAnalyses();
}

window.addEventListener('load', init);
