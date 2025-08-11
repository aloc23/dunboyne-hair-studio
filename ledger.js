
// Helpers for VAT & revenue
function computeLineTotals({unitPrice, qty, discount, voucher}){
  const gross = (unitPrice * qty) - (discount||0) - (voucher||0);
  return { gross: +gross.toFixed(2) };
}

function computeSaleTotals(lines, retailGross, vatMode, vatRate){
  const svcGross = lines.reduce((a,l)=> a + computeLineTotals(l).gross, 0);
  const totalGross = svcGross + (retailGross||0);
  let net, vat;
  if(vatMode==='include'){
    net = totalGross / (1 + vatRate/100);
    vat = totalGross - net;
  }else{
    net = totalGross;
    vat = totalGross * (vatRate/100);
  }
  return { svcGross:+svcGross.toFixed(2), totalGross:+totalGross.toFixed(2), net:+net.toFixed(2), vat:+vat.toFixed(2) };
}

// Compute exact COGS from service lines based on catalog
function computeCOGS(lines, catalog){
  const map = new Map(catalog.map(s=>[s.id,s]));
  let cogs=0;
  for(const l of lines){
    const svc = map.get(l.serviceId);
    if(!svc) continue;
    cogs += (svc.totalCost||0) * (l.qty||0);
  }
  return +cogs.toFixed(2);
}

// Summaries for reports
function listTakings(fromISO, toISO){
  const db = loadDB();
  return db.takings.filter(t=> (!fromISO || t.date>=fromISO) && (!toISO || t.date<=toISO));
}
function listExpenses(fromISO, toISO){
  const db = loadDB();
  return db.expenses.filter(e=> (!fromISO || e.date>=fromISO) && (!toISO || e.date<=toISO));
}

function closeMonthCOGS(ym){
  // Summarize COGS for the calendar month and add a journal entry; lock month
  const from = ym + "-01";
  const to = new Date(ym+"-01T00:00:00Z");
  to.setMonth(to.getMonth()+1);
  to.setDate(0); // last day prev
  const toISO = to.toISOString().slice(0,10);

  const takings = listTakings(from, toISO);
  const catalog = getCatalog();
  const cogs = takings.reduce((sum,t)=> sum + computeCOGS(t.lines,catalog), 0);
  addJournal({type:"COGS_SUMMARY", month: ym, amount:+cogs.toFixed(2)});
  lockMonth(ym);
  return cogs;
}
