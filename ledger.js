
const ACCOUNTS = {
  CASH: '1000-Cash',
  BANK: '1010-Bank',
  SALES_SERV: '4000-Sales Services',
  SALES_RETAIL: '4010-Sales Retail',
  VAT_OUT: '2100-VAT Payable',
  VAT_IN: '1150-VAT Input',
  VOUCHERS_LIAB: '2200-Unearned Revenue (Vouchers)',
  REFUNDS: '4090-Refunds (contra)',
  EXPENSE: '5000-Expense (generic)'
};
function splitVAT(gross, rate, mode){
  const r = (Number(rate)||0)/100;
  if(mode==='add'){
    const net = gross;
    const vat = net*r;
    const total = net+vat;
    return {net, vat, total};
  } else {
    const divisor = 1 + r;
    const net = divisor ? gross/divisor : gross;
    const vat = gross - net;
    return {net, vat, total: gross};
  }
}
async function postTakings({date, servicesGross, retailGross, refundsGross, cash, card, vouchersIn, vouchersOut, vatRate, vatMode, note}){
  const settings = await DB.kvGet('settings') || { vat: 23, vatMode: 'include' };
  const rate = (typeof vatRate === 'number') ? vatRate : (settings.vat || 23);
  const mode = vatMode || settings.vatMode || 'include';
  const svc = splitVAT(Number(servicesGross||0), rate, mode);
  const ret = splitVAT(Number(retailGross||0), rate, mode);
  const ref = splitVAT(Number(refundsGross||0), rate, mode);
  const lines = [];
  if(cash>0) lines.push({account:ACCOUNTS.CASH, debit:cash, credit:0});
  if(card>0) lines.push({account:ACCOUNTS.BANK, debit:card, credit:0});
  if(svc.total>0){
    lines.push({account:ACCOUNTS.SALES_SERV, debit:0, credit:svc.net});
    if(svc.vat>0) lines.push({account:ACCOUNTS.VAT_OUT, debit:0, credit:svc.vat});
  }
  if(ret.total>0){
    lines.push({account:ACCOUNTS.SALES_RETAIL, debit:0, credit:ret.net});
    if(ret.vat>0) lines.push({account:ACCOUNTS.VAT_OUT, debit:0, credit:ret.vat});
  }
  if(ref.total>0){
    lines.push({account:ACCOUNTS.REFUNDS, debit:ref.net, credit:0});
    if(ref.vat>0) lines.push({account:ACCOUNTS.VAT_OUT, debit:ref.vat, credit:0});
    const out = ref.total;
    if(out>0) lines.push({account:ACCOUNTS.BANK, debit:0, credit:out});
  }
  if(vouchersIn>0){
    lines.push({account:ACCOUNTS.CASH, debit:vouchersIn, credit:0});
    lines.push({account:ACCOUNTS.VOUCHERS_LIAB, debit:0, credit:vouchersIn});
  }
  if(vouchersOut>0){
    const v = splitVAT(vouchersOut, rate, mode);
    lines.push({account:ACCOUNTS.VOUCHERS_LIAB, debit:vouchersOut, credit:0});
    lines.push({account:ACCOUNTS.SALES_SERV, debit:0, credit:v.net});
    if(v.vat>0) lines.push({account:ACCOUNTS.VAT_OUT, debit:0, credit:v.vat});
  }
  const entry = { date, memo: `Takings ${note||''}`.trim(), source: 'takings', lines };
  await DB.add('journal', entry);
  await DB.add('takings', {date, servicesGross, retailGross, refundsGross, cash, card, vouchersIn, vouchersOut, vatRate:rate, vatMode:mode, note});
  return entry;
}
async function postExpense({date, supplier, category, net, vatRate, total}){
  const rate = Number(vatRate||0);
  let n = Number(net||0);
  let t = Number(total||0);
  if(!n && t && rate){ n = t / (1+rate/100); }
  else if(!t && n){ t = n * (1+rate/100); }
  const vat = t - n;
  const lines = [
    {account: `${ACCOUNTS.EXPENSE} - ${category||'General'}`, debit:n, credit:0},
  ];
  if(vat>0) lines.push({account:ACCOUNTS.VAT_IN, debit:vat, credit:0});
  lines.push({account:ACCOUNTS.BANK, debit:0, credit:t});
  const entry = { date, memo:`Expense ${supplier||''}`.trim(), source:'expense', lines };
  await DB.add('journal', entry);
  await DB.add('expenses', {date, supplier, category, net:n, vatRate:rate, total:t});
  return entry;
}
async function journalBetween(from, to){
  const all = await DB.all('journal');
  const f = from ? new Date(from) : new Date('1970-01-01');
  const t = to ? new Date(to) : new Date('2999-12-31');
  return all.filter(j=>{
    const d = new Date(j.date);
    return d>=f && d<=t;
  });
}
window.Ledger = { postTakings, postExpense, journalBetween, ACCOUNTS, splitVAT };
