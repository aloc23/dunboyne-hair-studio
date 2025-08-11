
// Ledger util
const Ledger = {
  postTakings({date, weekStart, weekEnd, servicesGross, retailGross, cashIn, cardIn, vouchersIn, vouchersOut, refunds, vatMode, vatRate}){
    // Normalize amounts
    const g = (x)=>Math.max(0, Number(x||0));
    servicesGross=g(servicesGross); retailGross=g(retailGross); cashIn=g(cashIn); cardIn=g(cardIn); vouchersIn=g(vouchersIn); vouchersOut=g(vouchersOut); refunds=g(refunds);
    vatRate = Number(vatRate);
    // Split net/VAT for sales
    function split(gross){
      if(vatMode==='include'){ const net = gross/(1+vatRate); return {net, vat: gross-net}; }
      else { const net = gross; return {net, vat: gross*vatRate}; }
    }
    const svc = split(servicesGross);
    const rtl = split(retailGross);

    // Build journal lines
    const lines = [];
    // cash/bank
    if(cashIn>0) lines.push({account:'Cash', debit:cashIn, credit:0});
    if(cardIn>0) lines.push({account:'Bank', debit:cardIn, credit:0});
    // vouchers sold is liability
    if(vouchersIn>0) lines.push({account:'Cash', debit:vouchersIn, credit:0});
    if(vouchersIn>0) lines.push({account:'Unearned Revenue (Vouchers)', debit:0, credit:vouchersIn});

    // revenue
    if(svc.net>0) lines.push({account:'Sales - Services', debit:0, credit:svc.net});
    if(rtl.net>0) lines.push({account:'Sales - Retail', debit:0, credit:rtl.net});
    const outVat = svc.vat + rtl.vat;
    if(outVat>0) lines.push({account:'VAT Payable', debit:0, credit:outVat});

    // voucher redemption reduces liability and credits sales
    if(vouchersOut>0){
      const v = split(vouchersOut);
      lines.push({account:'Unearned Revenue (Vouchers)', debit:vouchersOut, credit:0});
      lines.push({account:'Sales - Services', debit:0, credit:v.net}); // assume service redemption
      if(v.vat>0) lines.push({account:'VAT Payable', debit:0, credit:v.vat});
    }
    // refunds
    if(refunds>0){
      const r = split(refunds);
      lines.push({account:'Sales - Services', debit:r.net, credit:0});
      if(r.vat>0) lines.push({account:'VAT Payable', debit:r.vat, credit:0});
      lines.push({account:'Cash', debit:0, credit:refunds});
    }

    // Save journal entry
    const id = 'J'+(DB.data.journal.length+1).toString().padStart(5,'0');
    const memo = (weekStart && weekEnd) ? `Takings week ${weekStart}..${weekEnd}` : `Takings ${date}`;
    DB.data.journal.push({id, date: (weekEnd||date), memo, lines});
    DB.data.takings.push({id, date, weekStart, weekEnd, servicesGross, retailGross, cashIn, cardIn, vouchersIn, vouchersOut, refunds, vatMode, vatRate});
    DB.save();
    return id;
  },

  postExpense({date, supplier, category, net, vatRate, total}){
    net = Number(net||0); vatRate = Number(vatRate||0);
    if(!total){ total = net*(1+vatRate); }
    total = Number(total);
    const vatAmt = total - net;
    const lines = [
      {account:`Expense - ${category}`, debit:net, credit:0},
    ];
    if(vatAmt>0) lines.push({account:'VAT Input', debit:vatAmt, credit:0});
    lines.push({account:'Cash', debit:0, credit:total});

    const id = 'J'+(DB.data.journal.length+1).toString().padStart(5,'0');
    DB.data.journal.push({id, date, memo:`Expense ${supplier}`, lines});
    DB.data.expenses.push({id, date, supplier, category, net, vatRate, total});
    DB.save();
    return id;
  },

  // Trial balance between dates
  balances(from, to){
    const f = from? new Date(from): new Date('1970-01-01');
    const t = to? new Date(to): new Date('2999-12-31');
    const bal = {};
    DB.data.journal.forEach(j=>{
      const d = new Date(j.date);
      if(d>=f && d<=t){
        j.lines.forEach(l=>{
          bal[l.account] = bal[l.account] || 0;
          bal[l.account] += Number(l.debit||0) - Number(l.credit||0);
        });
      }
    });
    return bal;
  },

  pl(from, to){
    const bal = this.balances(from, to);
    const incomeAcc = Object.keys(bal).filter(a=>a.startsWith('Sales'));
    const expenseAcc = Object.keys(bal).filter(a=>a.startsWith('Expense'));
    const income = incomeAcc.reduce((s,a)=> s - Math.min(0, bal[a]) + Math.max(0, -bal[a]), 0);
    // simpler: sum credits of Sales from journal directly
    let sales = 0;
    DB.data.journal.forEach(j=>{
      const d=new Date(j.date); if((!from||d>=new Date(from)) && (!to||d<=new Date(to))){
        j.lines.forEach(l=>{ if(l.account.startsWith('Sales')) sales += Number(l.credit||0) - Number(l.debit||0); });
      }
    });
    // COGS not auto-posted; zero for MVP
    const cogs = 0;
    const expenses = expenseAcc.reduce((s,a)=> s + Math.max(0, bal[a]), 0);
    const grossProfit = sales - cogs;
    const operating = grossProfit - expenses;
    return {sales, cogs, expenses, grossProfit, operating};
  },

  vatReport(from, to){
    let out=0, inp=0;
    DB.data.journal.forEach(j=>{
      const d=new Date(j.date); if((!from||d>=new Date(from)) && (!to||d<=new Date(to))){
        j.lines.forEach(l=>{
          if(l.account==='VAT Payable') out += Number(l.credit||0) - Number(l.debit||0);
          if(l.account==='VAT Input') inp += Number(l.debit||0) - Number(l.credit||0);
        });
      }
    });
    return {outputVAT: out, inputVAT: inp, net: out - inp};
  },

  balanceSheet(asOf){
    const bal = this.balances(null, asOf);
    function a(name){ return bal[name]||0; }
    const assets = { Cash: a('Cash'), Bank: a('Bank'), Inventory: a('Inventory') };
    const liabilities = { 'VAT Payable': (a('VAT Payable')<0? -a('VAT Payable'): a('VAT Payable')), 'Unearned Revenue (Vouchers)': (a('Unearned Revenue (Vouchers)')<0?-a('Unearned Revenue (Vouchers)'):a('Unearned Revenue (Vouchers)')) };
    // Simple retained earnings approximation: sum of operating results to date
    const pl = this.pl(null, asOf);
    const equity = { 'Retained Earnings (approx)': pl.operating };
    return {assets, liabilities, equity};
  }
};

// Wire UI buttons
$('#post-takings').addEventListener('click', ()=>{
  const payload = {
    date: $('#takings-date').value,
    weekStart: $('#week-start').value || null,
    weekEnd: $('#week-end').value || null,
    servicesGross: $('#services-gross').value,
    retailGross: $('#retail-gross').value,
    cashIn: $('#cash-in').value,
    cardIn: $('#card-in').value,
    vouchersIn: $('#vouchers-in').value,
    vouchersOut: $('#vouchers-out').value,
    refunds: $('#refunds').value,
    vatMode: $('#vat-mode').value,
    vatRate: Number($('#vat-rate').value)/100.0
  };
  const id = Ledger.postTakings(payload);
  $('#takings-status').textContent = `Posted ${id}`;
  setTimeout(()=>$('#takings-status').textContent='', 2000);
});

$('#post-expense').addEventListener('click', ()=>{
  const payload = {
    date: $('#exp-date').value,
    supplier: $('#exp-supplier').value,
    category: $('#exp-category').value,
    net: $('#exp-net').value,
    vatRate: $('#exp-vat').value,
    total: $('#exp-total').value
  };
  const id = Ledger.postExpense(payload);
  $('#expense-status').textContent = `Posted ${id}`;
  setTimeout(()=>$('#expense-status').textContent='', 2000);
});
