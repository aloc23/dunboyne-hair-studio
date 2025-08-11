
function sum(arr){ return arr.reduce((a,b)=>a+Number(b||0),0); }
function computeBalances(journals){
  const balances = {};
  for(const j of journals){
    for(const l of j.lines){
      if(!balances[l.account]) balances[l.account]=0;
      balances[l.account] += Number(l.debit||0);
      balances[l.account] -= Number(l.credit||0);
    }
  }
  return balances;
}
function plFrom(balances){
  const sales = Object.entries(balances).filter(([acc])=>acc.startsWith('4000') || acc.startsWith('4010') || acc.includes('Sales'));
  const refunds = Object.entries(balances).filter(([acc])=>acc.includes('Refunds'));
  const expenses = Object.entries(balances).filter(([acc])=>acc.startsWith('5000') || acc.includes('Expense'));
  const salesTotal = sum(sales.map(([,v])=>-v));
  const refundsTotal = sum(refunds.map(([,v])=>v));
  const expenseTotal = sum(expenses.map(([,v])=>v));
  const grossProfit = salesTotal - refundsTotal - expenseTotal;
  return { sales, refunds, expenses, salesTotal, refundsTotal, expenseTotal, grossProfit };
}
function bsFrom(balances){
  const assets = [], liabs = [], equity = [];
  for(const [acc,bal] of Object.entries(balances)){
    if(acc.startsWith('1')) assets.push([acc,bal]);
    else if(acc.startsWith('2')) liabs.push([acc,bal]);
    else if(acc.startsWith('3')) equity.push([acc,bal]);
  }
  const assetsTotal = sum(assets.map(([,v])=>v));
  const liabsTotal = sum(liabs.map(([,v])=>v));
  const equityTotal = sum(equity.map(([,v])=>v));
  return {assets, liabs, equity, assetsTotal, liabsTotal, equityTotal};
}
function vatSummary(journals){
  let out=0, inp=0;
  for(const j of journals){
    for(const l of j.lines){
      if(l.account.includes('VAT Payable')) out += Number(l.credit||0) - Number(l.debit||0);
      if(l.account.includes('VAT Input')) inp += Number(l.debit||0) - Number(l.credit||0);
    }
  }
  const due = out - inp;
  return { output: out, input: inp, due };
}
function renderTable(el, rows){
  const html = [`<tr>${rows.headers.map(h=>`<th>${h}</th>`).join('')}</tr>`]
    .concat(rows.rows.map(r=>`<tr>${r.map(c=>`<td>${typeof c==='number'?c.toFixed(2):c}</td>`).join('')}</tr>`));
  el.innerHTML = `<table>${html.join('')}</table>`;
}
window.Reports = { computeBalances, plFrom, bsFrom, vatSummary, renderTable };
