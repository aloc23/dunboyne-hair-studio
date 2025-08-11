import { runStatements } from './ledger.js';

function fmt(n){ return '€'+(Math.round(n*100)/100).toFixed(2); }

async function runMonthly(){
  const val = document.getElementById('monthPicker').value; if(!val) return;
  const [y,m] = val.split('-');
  const from = `${y}-${m}-01`;
  const to = new Date(+y, +m, 0).toISOString().slice(0,10);
  const r = await runStatements(from,to);
  const html = `
  <table>
    <tbody>
      <tr><td>Revenue</td><td>${fmt(r.income)}</td></tr>
      <tr><td>COGS (supplies)</td><td>${fmt(r.cogs)}</td></tr>
      <tr><td><strong>Gross Profit</strong></td><td><strong>${fmt(r.grossProfit)}</strong></td></tr>
      <tr><td>Operating Expenses</td><td>${fmt(r.expenses)}</td></tr>
      <tr><td><strong>Operating Profit</strong></td><td><strong>${fmt(r.opProfit)}</strong></td></tr>
      <tr><td>VAT Due</td><td>${fmt(r.vatDue)}</td></tr>
    </tbody>
  </table>`;
  document.getElementById('monthlyOut').innerHTML = html;
}

async function runFS(){
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;
  const r = await runStatements(from,to);
  const html = `
  <h3>P&L</h3>
  <table><tbody>
  <tr><td>Revenue</td><td>${fmt(r.income)}</td></tr>
  <tr><td>COGS</td><td>${fmt(r.cogs)}</td></tr>
  <tr><td>Expenses</td><td>${fmt(r.expenses)}</td></tr>
  <tr><td><strong>Net Profit</strong></td><td><strong>${fmt(r.opProfit)}</strong></td></tr>
  </tbody></table>
  <h3>Balance Sheet</h3>
  <table><tbody>
  <tr><td>Assets</td><td>${fmt(r.assets)}</td></tr>
  <tr><td>Liabilities</td><td>${fmt(r.liabilities)}</td></tr>
  <tr><td>Equity</td><td>${fmt(r.equity)}</td></tr>
  </tbody></table>
  `;
  document.getElementById('fsOut').innerHTML = html;
}

document.getElementById('runMonthly').addEventListener('click', runMonthly);
document.getElementById('runFS').addEventListener('click', runFS);
