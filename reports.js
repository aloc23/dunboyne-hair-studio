
function renderReports(fromISO, toISO){
  const settings = getSettings();
  const vatMode = settings.vatMode;
  const vatRate = settings.vatRate;

  const catalog = getCatalog();
  const takings = listTakings(fromISO, toISO);
  let svcGross = 0, totalGross = 0, net=0, vat=0, retailGross=0, cogs=0;
  for(const t of takings){
    const sum = computeSaleTotals(t.lines, t.retailGross||0, t.vatMode, t.vatRate);
    svcGross += sum.svcGross;
    retailGross += (t.retailGross||0);
    totalGross += sum.totalGross;
    // We need net/vat summation: recompute per-entry for accuracy
    net += (t.vatMode==='include') ? sum.net : sum.net; // both already net
    vat += sum.vat;
    cogs += computeCOGS(t.lines, catalog);
  }
  const expenses = listExpenses(fromISO, toISO);
  const expNet = expenses.reduce((a,e)=>a+e.net,0);
  const expVAT = expenses.reduce((a,e)=>a+e.vat,0);
  const expTotal = expNet + expVAT;

  const grossProfit = totalGross - cogs;
  const operatingProfit = grossProfit - expNet; // exclude input VAT from P&L

  const el = document.getElementById('report-output');
  el.innerHTML = `
    <div class="kpis">
      <div class="chip">Services Gross € ${svcGross.toFixed(2)}</div>
      <div class="chip">Retail Gross € ${retailGross.toFixed(2)}</div>
      <div class="chip">Revenue Gross € ${totalGross.toFixed(2)}</div>
      <div class="chip">VAT Output € ${vat.toFixed(2)}</div>
      <div class="chip">COGS € ${cogs.toFixed(2)}</div>
      <div class="chip">Gross Profit € ${grossProfit.toFixed(2)}</div>
      <div class="chip">Expenses (Net) € ${expNet.toFixed(2)}</div>
      <div class="chip">Operating Profit € ${operatingProfit.toFixed(2)}</div>
    </div>
    <h3 class="mt">Expenses</h3>
    <table class="table">
      <thead><tr><th>Date</th><th>Category</th><th>Supplier</th><th>Net</th><th>VAT</th><th>Total</th></tr></thead>
      <tbody>
        ${expenses.map(e=>`<tr><td>${e.date}</td><td>${e.category}</td><td>${e.supplier||''}</td><td>${e.net.toFixed(2)}</td><td>${e.vat.toFixed(2)}</td><td>${e.total.toFixed(2)}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}
