
function fmt(n){ return '€ '+(Number(n)||0).toFixed(2); }
document.getElementById('run-reports').addEventListener('click', ()=>{
  const f = document.getElementById('rep-from').value;
  const t = document.getElementById('rep-to').value;
  const pl = Ledger.pl(f, t);
  document.getElementById('pl').innerHTML = `
    <div class="kpis">
      <div class="kpi"><h3>Sales</h3><div class="v">${fmt(pl.sales)}</div></div>
      <div class="kpi"><h3>COGS</h3><div class="v">${fmt(pl.cogs)}</div></div>
      <div class="kpi"><h3>Expenses</h3><div class="v">${fmt(pl.expenses)}</div></div>
      <div class="kpi"><h3>Operating Profit</h3><div class="v">${fmt(pl.operating)}</div></div>
    </div>`;
  const bs = Ledger.balanceSheet(t||new Date().toISOString().slice(0,10));
  const a = Object.entries(bs.assets).map(([k,v])=>`<div class="kpi"><h3>${k}</h3><div class="v">${fmt(v)}</div></div>`).join('');
  const l = Object.entries(bs.liabilities).map(([k,v])=>`<div class="kpi"><h3>${k}</h3><div class="v">${fmt(v)}</div></div>`).join('');
  const e = Object.entries(bs.equity).map(([k,v])=>`<div class="kpi"><h3>${k}</h3><div class="v">${fmt(v)}</div></div>`).join('');
  document.getElementById('bs').innerHTML = `<h3>Assets</h3><div class="kpis">${a}</div><h3>Liabilities</h3><div class="kpis">${l}</div><h3>Equity</h3><div class="kpis">${e}</div>`;
  const vr = Ledger.vatReport(f,t);
  document.getElementById('vat').innerHTML = `
    <h3>VAT Summary</h3>
    <div class="kpis">
      <div class="kpi"><h3>Output VAT</h3><div class="v">${fmt(vr.outputVAT)}</div></div>
      <div class="kpi"><h3>Input VAT</h3><div class="v">${fmt(vr.inputVAT)}</div></div>
      <div class="kpi"><h3>VAT Due</h3><div class="v">${fmt(vr.net)}</div></div>
    </div>`;
});

document.getElementById('run-monthly').addEventListener('click', ()=>{
  const m = document.getElementById('rep-month').value; // YYYY-MM
  if(!m){ alert('Choose a month'); return; }
  const from = m+'-01';
  const to = new Date(new Date(from).getFullYear(), new Date(from).getMonth()+1, 0).toISOString().slice(0,10);
  const pl = Ledger.pl(from, to);
  const vat = Ledger.vatReport(from, to);
  const html = `
    <div class="kpis">
      <div class="kpi"><h3>Revenue</h3><div class="v">${fmt(pl.sales)}</div></div>
      <div class="kpi"><h3>COGS</h3><div class="v">${fmt(pl.cogs)}</div></div>
      <div class="kpi"><h3>Expenses</h3><div class="v">${fmt(pl.expenses)}</div></div>
      <div class="kpi"><h3>Operating Profit</h3><div class="v">${fmt(pl.operating)}</div></div>
      <div class="kpi"><h3>VAT Due</h3><div class="v">${fmt(vat.net)}</div></div>
    </div>`;
  document.getElementById('monthly-summary').innerHTML = html;
});
