
import { getAll, add, put, getByIndex } from './db.js';

export function vatSplit(amountGross, ratePct, mode) {
  const rate = (ratePct || 0)/100;
  if (!rate) return { net: amountGross, vat: 0 };
  if (mode === 'include') {
    const net = amountGross / (1+rate);
    const vat = amountGross - net;
    return { net, vat };
  } else {
    const vat = amountGross * rate;
    const net = amountGross; // price before VAT
    return { net, vat };
  }
}

async function findAccountId(nameContains) {
  const accounts = await getAll('accounts');
  const a = accounts.find(a => a.name.toLowerCase().includes(nameContains.toLowerCase()));
  return a ? a.id : null;
}

export async function postTakings(tk) {
  // tk: {date, stylistId, servicesGross, retailGross, vatRate, cash, card, vouchersIn, vouchersOut, refunds, vatMode}
  const salesServicesId = await findAccountId('Sales - Services');
  const salesRetailId   = await findAccountId('Sales - Retail');
  const cashId = await findAccountId('Cash');
  const bankId = await findAccountId('Bank');
  const vatPayableId = await findAccountId('VAT Payable');
  const vouchersId = await findAccountId('Unearned Revenue');
  
  const date = tk.date;
  const lines = [];
  const memo = 'Daily takings';

  // Split services
  const s = vatSplit(tk.servicesGross, tk.vatRate, tk.vatMode);
  const r = vatSplit(tk.retailGross, tk.vatRate, tk.vatMode);
  const refunds = vatSplit(tk.refunds || 0, tk.vatRate, tk.vatMode);

  // Receipts side
  if ((tk.cash||0) > 0) lines.push({ accountId: cashId, debit: tk.cash, credit: 0 });
  if ((tk.card||0) > 0) lines.push({ accountId: bankId, debit: tk.card, credit: 0 });
  if ((tk.vouchersIn||0) > 0) lines.push({ accountId: vouchersId, debit: tk.vouchersIn, credit: 0 });

  // Sales side (net)
  if (s.net > 0) lines.push({ accountId: salesServicesId, debit:0, credit: s.net });
  if (r.net > 0) lines.push({ accountId: salesRetailId, debit:0, credit: r.net });
  // VAT output
  const vatOut = s.vat + r.vat - refunds.vat;
  if (vatOut !== 0) lines.push({ accountId: vatPayableId, debit:0, credit: vatOut });

  // Voucher redemptions reduce liability and become revenue already included above.
  if ((tk.vouchersOut||0) > 0) {
    lines.push({ accountId: vouchersId, debit: tk.vouchersOut, credit: 0 });
    // Offset: assume included in cash/card totals already; if not, they'd credit sales here.
  }

  // Refunds reduce sales (credit->debit) and VAT payable
  if (refunds.net > 0) {
    // reverse sales by debiting income
    // allocate refunds proportionally to services first
    if (s.net > 0) lines.push({ accountId: salesServicesId, debit: refunds.net, credit: 0 });
    else lines.push({ accountId: salesRetailId, debit: refunds.net, credit: 0 });
  }

  const entry = { date, memo, source:'takings', lines, createdAt: new Date().toISOString() };
  await add('journal_entries', entry);
  await add('takings', { ...tk, postedAt: new Date().toISOString() });
  return entry;
}

export async function postExpense(ex) {
  const vatInputId = (await getAll('accounts')).find(a => a.name==='VAT Input')?.id;
  const cashId = (await getAll('accounts')).find(a => a.name==='Cash')?.id;
  const bankId = (await getAll('accounts')).find(a => a.name==='Bank')?.id;
  // category account id
  const cat = (await getAll('accounts')).find(a => a.id === ex.categoryAccountId);
  const payId = ex.payMethod==='cash' ? cashId : bankId;

  const vat = (ex.net||0) * (ex.vatRate||0)/100;
  const total = (ex.net||0) + vat;

  const lines = [
    { accountId: ex.categoryAccountId, debit: ex.net, credit: 0 },
  ];
  if (vat > 0 && vatInputId) lines.push({ accountId: vatInputId, debit: vat, credit: 0 });
  lines.push({ accountId: payId, debit: 0, credit: total });

  const entry = { date: ex.date, memo:`Expense: ${ex.supplier||''}`, source:'expense', lines, createdAt: new Date().toISOString() };
  await add('journal_entries', entry);
  await add('expenses', { ...ex, total });
  return entry;
}

export async function listJournal(limit=20) {
  const all = await getAll('journal_entries');
  return all.sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0, limit);
}

export async function trialBalance(uptoDate=null) {
  const all = await getAll('journal_entries');
  const accounts = await getAll('accounts');
  const map = new Map(accounts.map(a => [a.id, 0]));
  for (const je of all) {
    if (uptoDate && new Date(je.date) > new Date(uptoDate)) continue;
    for (const l of je.lines) {
      map.set(l.accountId, (map.get(l.accountId)||0) + (l.debit||0) - (l.credit||0));
    }
  }
  return map; // debit positive
}

export async function reportPNL(periodYYYYMM) {
  const [y,m] = periodYYYYMM.split('-').map(Number);
  const start = new Date(y, m-1, 1);
  const end = new Date(y, m, 0); // last day
  const all = await getAll('journal_entries');
  const accounts = await getAll('accounts');
  const byId = Object.fromEntries(accounts.map(a=>[a.id, a]));
  const sums = {};
  for (const je of all) {
    const d = new Date(je.date);
    if (d < start || d > end) continue;
    for (const l of je.lines) {
      const acc = byId[l.accountId];
      if (!acc) continue;
      if (acc.type==='income' || acc.type==='expense') {
        sums[l.accountId] = (sums[l.accountId]||0) + (acc.type==='expense' ? (l.debit - l.credit) : (l.credit - l.debit));
      }
    }
  }
  const rows = Object.entries(sums).map(([id, amount]) => ({ account: byId[id].name, amount }));
  const totalIncome = rows.filter(r=>r.amount>0).reduce((a,b)=>a+b.amount,0);
  const totalExpense = rows.filter(r=>r.amount<0).reduce((a,b)=>a+b.amount,0);
  const net = totalIncome + totalExpense; // expenses negative
  return { rows, totalIncome, totalExpense, net };
}

export async function reportBalanceSheet(asOfYYYYMM) {
  const [y,m] = asOfYYYYMM.split('-').map(Number);
  const asOf = new Date(y, m, 0);
  const tb = await trialBalance(asOf.toISOString());
  const accounts = await getAll('accounts');
  const byId = Object.fromEntries(accounts.map(a=>[a.id, a]));
  const rows = [];
  for (const [id, bal] of tb.entries()) {
    const acc = byId[id];
    if (!acc) continue;
    if (acc.type==='asset' || acc.type==='liability' || acc.type==='equity') {
      const amount = (acc.type==='asset') ? bal : -bal; // liabilities/equity are credit-normal
      rows.push({ account: acc.name, amount });
    }
  }
  return rows;
}

export async function reportVAT(periodYYYYMM) {
  const [y,m] = periodYYYYMM.split('-').map(Number);
  const start = new Date(y, m-1, 1);
  const end = new Date(y, m, 0);
  const all = await getAll('journal_entries');
  const accounts = await getAll('accounts');
  const vatPayId = accounts.find(a=>a.name==='VAT Payable')?.id;
  const vatInId  = accounts.find(a=>a.name==='VAT Input')?.id;
  let output=0, input=0;
  for (const je of all) {
    const d = new Date(je.date);
    if (d < start || d > end) continue;
    for (const l of je.lines) {
      if (l.accountId===vatPayId) output += (l.credit||0)-(l.debit||0);
      if (l.accountId===vatInId) input += (l.debit||0)-(l.credit||0);
    }
  }
  return { output, input, net: output - input };
}

export async function reportCommission(periodYYYYMM) {
  const stylists = await getAll('stylists');
  // For MVP we compute 0 unless later we attribute takings per stylist and add commission rate
  return stylists.map(s => ({ name: s.name, commission: 0 }));
}
