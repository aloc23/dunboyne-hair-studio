// Ledger & reports
const ACC = {
  CASH: 'Cash',
  BANK: 'Bank',
  SALES_SVCS: 'Sales Services',
  SALES_RETAIL: 'Sales Retail',
  VAT_PAYABLE: 'VAT Payable',
  VOUCHERS: 'Unearned Revenue',
  COGS: 'Cost of Goods Sold',
  INVENTORY: 'Inventory (Virtual)',
  EXPENSE: 'Expenses'
};

function splitVAT(amountIncl, rate){
  const net = amountIncl / (1 + rate/100);
  const vat = amountIncl - net;
  return {net, vat};
}

async function postTakings({date, vatMode, vatRate, services, retailGross, cash, card, vouchers, refunds}){
  // Compute totals from services
  const servicesGross = services.reduce((s,l)=> s + l.qty * l.priceIncl, 0);
  const servicesCOGS = services.reduce((s,l)=> s + l.qty * l.trueCost, 0);
  const totalGross = servicesGross + retailGross - refunds;

  const je = { date, memo:'Takings', lines: [] };
  // Receipts
  if(cash>0) je.lines.push({account:ACC.CASH, debit:+cash});
  if(card>0) je.lines.push({account:ACC.BANK, debit:+card});
  // Refunds reduce receipts
  // Sales services
  if(servicesGross>0){
    if(vatMode==='include'){
      const {net, vat} = splitVAT(servicesGross, vatRate);
      je.lines.push({account:ACC.SALES_SVCS, credit:+net});
      if(vat>0) je.lines.push({account:ACC.VAT_PAYABLE, credit:+vat});
    }else{ // add
      je.lines.push({account:ACC.SALES_SVCS, credit:+servicesGross});
      const vat = servicesGross * vatRate/100;
      if(vat>0) je.lines.push({account:ACC.VAT_PAYABLE, credit:+vat});
    }
  }
  // Sales retail (treated like services for VAT at default rate)
  if(retailGross>0){
    if(vatMode==='include'){
      const {net, vat} = splitVAT(retailGross, vatRate);
      je.lines.push({account:ACC.SALES_RETAIL, credit:+net});
      if(vat>0) je.lines.push({account:ACC.VAT_PAYABLE, credit:+vat});
    }else{
      je.lines.push({account:ACC.SALES_RETAIL, credit:+retailGross});
      const vat = retailGross * vatRate/100;
      if(vat>0) je.lines.push({account:ACC.VAT_PAYABLE, credit:+vat});
    }
  }
  // Vouchers sold increase liability
  if(vouchers>0) je.lines.push({account:ACC.VOUCHERS, credit:+vouchers});

  // Balance the entry (Cash+Bank should equal totalGross+vouchers). We won't enforce strict equality in MVP.

  // Post COGS for services now (exact COGS)
  if(servicesCOGS>0){
    je.lines.push({account:ACC.COGS, debit:+servicesCOGS});
    je.lines.push({account:ACC.INVENTORY, credit:+servicesCOGS});
  }

  const id = await put('journal', je);
  await put('takings', { date, services, retailGross, cash, card, vouchers, refunds, vatMode, vatRate, journalId:id });
  return id;
}

async function closeMonthCOGS(period){ // YYYY-MM
  // Aggregate services from all takings in the month and post single COGS adjustment (if needed)
  const takings = await getAll('takings');
  const inMonth = takings.filter(t => (t.date||'').startsWith(period));
  let cogs = 0;
  for(const t of inMonth){
    for(const l of (t.services||[])) cogs += l.qty * l.trueCost;
  }
  if(cogs<=0) return null;
  const je = { date: period+'-28', memo:'Month-end COGS', lines:[
    {account:ACC.COGS, debit:+cogs},
    {account:ACC.INVENTORY, credit:+cogs}
  ]};
  const id = await put('journal', je);
  return id;
}

async function trialBalance(from, to){
  const js = await getAll('journal');
  const within = js.filter(j => (!from || j.date>=from) && (!to || j.date<=to));
  const bal = {};
  function post(a, d=0, c=0){
    bal[a] = bal[a] || {debit:0, credit:0};
    bal[a].debit += d; bal[a].credit += c;
  }
  for(const j of within){
    for(const l of j.lines){
      post(l.account, l.debit||0, l.credit||0);
    }
  }
  return bal;
}

function sum(arr){ return arr.reduce((s,x)=>s+x,0); }

async function statements(from, to){
  const tb = await trialBalance(from,to);
  const get = (name)=> tb[name]||{debit:0,credit:0};
  const sales = (get(ACC.SALES_SVCS).credit + get(ACC.SALES_RETAIL).credit) - get(ACC.SALES_SVCS).debit - get(ACC.SALES_RETAIL).debit;
  const cogs = get(ACC.COGS).debit - get(ACC.COGS).credit;
  const grossProfit = sales - cogs;
  const vatDue = get(ACC.VAT_PAYABLE).credit - get(ACC.VAT_PAYABLE).debit;
  const assets = get(ACC.CASH).debit - get(ACC.CASH).credit
               + get(ACC.BANK).debit - get(ACC.BANK).credit
               + get(ACC.INVENTORY).debit - get(ACC.INVENTORY).credit;
  const liabilities = get(ACC.VOUCHERS).credit - get(ACC.VOUCHERS).debit
                    + get(ACC.VAT_PAYABLE).credit - get(ACC.VAT_PAYABLE).debit;
  const equity = sales - cogs - (liabilities - vatDue); // simplified
  return { sales, cogs, grossProfit, vatDue, assets, liabilities, equity, tb };
}
