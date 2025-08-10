# Salon Accounting (Local PWA)

Local-first, offline-capable PWA for a salon in Ireland. Tracks daily takings, expenses, VAT (toggle include/add), generates P&L and Balance Sheet, plus a Cost Analyzer for true cost per service.

## Features
- Installable PWA (Add to Home Screen on iPad/desktop)
- Local storage (IndexedDB) — data stays on device
- Daily Takings and Expenses with **double-entry** ledger
- VAT mode toggle: **Include** (prices include VAT) or **Add**
- Reports: Profit & Loss, Balance Sheet
- Cost Analyzer: materials + labour + ops cost → margin
- Backup/restore JSON; export JSON of ledgers

## Quick start
Open `index.html` directly, or serve statically for best PWA behavior:
```bash
python -m http.server 8080
```

## Notes
- This is a minimal MVP and not professional accounting advice.
