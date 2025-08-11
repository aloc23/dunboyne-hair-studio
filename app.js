
const $ = (q)=>document.querySelector(q);
const $$ = (q)=>Array.from(document.querySelectorAll(q));

// Tab nav
$$('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const id = btn.dataset.tab;
  $$('.tab').forEach(t=>t.classList.remove('active'));
  $('#'+id).classList.add('active');
}));

// Takings mode UI
const modeSel = $('#takings-mode');
const dateLabel = $('#date-label');
const weekRange = $('#week-range');
modeSel.addEventListener('change', ()=>{
  if(modeSel.value==='weekly'){ weekRange.classList.remove('hidden'); dateLabel.classList.add('hidden'); }
  else { weekRange.classList.add('hidden'); dateLabel.classList.remove('hidden'); }
});

// Settings state
const settings = {
  vatMode: localStorage.getItem('vatMode') || 'include',
  vatRate: parseFloat(localStorage.getItem('vatRate')||'23'),
  currency: localStorage.getItem('currency') || 'EUR'
};
$('#vat-mode').value = settings.vatMode;
$('#vat-rate').value = settings.vatRate;
$('#currency').value = settings.currency;
$('#vat-mode').addEventListener('change', e=>{ settings.vatMode = e.target.value; localStorage.setItem('vatMode', settings.vatMode); });
$('#vat-rate').addEventListener('change', e=>{ settings.vatRate = parseFloat(e.target.value||'23'); localStorage.setItem('vatRate', settings.vatRate); });
$('#currency').addEventListener('change', e=>{ settings.currency = e.target.value||'EUR'; localStorage.setItem('currency', settings.currency); });

// Simple in-memory DB persisted in localStorage for MVP
const DB = {
  load(){ 
    this.data = JSON.parse(localStorage.getItem('db')||'{}');
    this.data.journal = this.data.journal || [];
    this.data.takings = this.data.takings || [];
    this.data.expenses = this.data.expenses || [];
    this.data.catalog = this.data.catalog || window.seedCatalog || {};
    localStorage.setItem('db', JSON.stringify(this.data));
  },
  save(){ localStorage.setItem('db', JSON.stringify(this.data)); }
};
DB.load();

// Export/Import
$('#export-json').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(DB.data, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='salon-backup.json'; a.click();
});
$('#import-btn').addEventListener('click', ()=>{
  const f = $('#import-json').files[0];
  if(!f){ alert('Choose a JSON backup file'); return; }
  const r = new FileReader();
  r.onload = ()=>{ try{ DB.data = JSON.parse(r.result); DB.save(); $('#data-log').textContent='Restore complete. Reload the page.'; } catch(e){ alert('Invalid JSON'); } };
  r.readAsText(f);
});

// Load seed JSON
fetch('seed.json').then(r=>r.json()).then(seed=>{
  DB.data.catalog = seed;
  DB.save();
  window.seedCatalog = seed;
  initCostAnalyzer(seed);
});
