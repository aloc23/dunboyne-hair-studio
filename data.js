
// Preloaded services (from your sheet) — editable in Catalog.
// Prices are VAT-inclusive by default; costs are totals per service instance.
const PRELOADED_SERVICES = [
  {name:"Bleach Tint", price:65.00, mins:45, products:4.82, utilities:9.57, labour:10.95},
  {name:"Cleanse", price:30.00, mins:30, products:7.02, utilities:6.38, labour:7.30},
  {name:"Hi-Lift", price:55.00, mins:45, products:9.22, utilities:9.57, labour:10.95},
  {name:"Masking", price:35.00, mins:15, products:4.33, utilities:3.19, labour:3.65},
  {name:"Root Melt", price:55.00, mins:30, products:7.52, utilities:6.38, labour:7.30},
  {name:"Root Tint", price:50.00, mins:30, products:7.52, utilities:6.38, labour:7.30},
  {name:"Semi Long", price:50.00, mins:30, products:7.01, utilities:6.38, labour:7.30},
  {name:"Semi Short", price:46.00, mins:20, products:6.47, utilities:4.25, labour:4.87},
  {name:"Colour Bomb", price:10.00, mins:10, products:4.94, utilities:2.13, labour:2.43},
  {name:"K18 to Colour", price:25.00, mins:5, products:2.36, utilities:1.06, labour:1.22},
  {name:"L'oreal Detox", price:20.00, mins:5, products:2.36, utilities:1.06, labour:1.22},
  {name:"Malabu C", price:30.00, mins:90, products:6.47, utilities:19.14, labour:21.91},
  {name:"Revlon Gloss Treat", price:20.00, mins:10, products:4.82, utilities:2.13, labour:2.43},
  {name:"Revlon Scalp Treatment", price:40.00, mins:5, products:5.42, utilities:1.06, labour:1.22},
  {name:"Revlon Scalp Mask", price:15.00, mins:5, products:2.36, utilities:1.06, labour:1.22},
  {name:"Treatment", price:10.00, mins:10, products:2.36, utilities:2.13, labour:2.43},
  {name:"Curly Blowdry", price:32.00, mins:35, products:9.58, utilities:7.44, labour:8.52},
  {name:"Gent Cut", price:17.00, mins:30, products:3.80, utilities:6.38, labour:7.30},
  {name:"Gents Wash and Cut", price:17.00, mins:30, products:3.80, utilities:6.38, labour:7.30},
  {name:"cut blowdry long", price:57.00, mins:45, products:9.58, utilities:9.57, labour:10.95},
  {name:"cut medium", price:52.00, mins:45, products:5.25, utilities:9.57, labour:10.95},
  {name:"cut short", price:47.00, mins:45, products:3.80, utilities:9.57, labour:10.95},
  {name:"oap", price:37.00, mins:30, products:3.80, utilities:6.38, labour:7.30},
  {name:"short blowdry", price:24.00, mins:30, products:6.69, utilities:6.38, labour:7.30},
  {name:"long blowdry", price:29.00, mins:30, products:10.30, utilities:6.38, labour:7.30},
  {name:"medium blowdry", price:27.00, mins:30, products:9.85, utilities:6.38, labour:7.30},
  {name:"1/2 head medium", price:65.00, mins:45, products:11.12, utilities:9.57, labour:10.95},
  {name:"1/2 head long", price:75.00, mins:45, products:12.50, utilities:9.57, labour:10.95},
  {name:"baby lights", price:70.00, mins:60, products:15.51, utilities:12.76, labour:14.60},
  {name:"balyage", price:85.00, mins:75, products:3.24, utilities:15.95, labour:18.26},
  {name:"half head short", price:60.00, mins:45, products:14.56, utilities:9.57, labour:10.95},
  {name:"full head short", price:70.00, mins:60, products:19.39, utilities:12.76, labour:14.60},
  {name:"full headlong", price:88.00, mins:75, products:23.37, utilities:15.95, labour:18.26},
  {name:"upstyle", price:45.00, mins:45, products:11.03, utilities:9.57, labour:10.95},
  {name:"colour change", price:88.00, mins:90, products:13.43, utilities:19.14, labour:21.91},
  {name:"face framing", price:55.00, mins:45, products:5.67, utilities:9.57, labour:10.95},
  {name:"floods", price:15.00, mins:30, products:6.11, utilities:6.38, labour:7.30},
  {name:"tbar long", price:50.00, mins:30, products:6.80, utilities:6.38, labour:7.30},
  {name:"tbar short", price:40.00, mins:30, products:6.80, utilities:6.38, labour:7.30}
];

const DEFAULT_EXPENSE_CATEGORIES = ["Rent","Electricity","Rates","Water","Insurance","Waste/Bins","Comms","Booking software","Supplies","Sundry"];

const DEFAULT_UTILITIES = [
  {name:"Rent", perMonth:1600.00},
  {name:"Airtricity", perMonth:800.00},
  {name:"Rates", perMonth:202.00},
  {name:"Water", perMonth:400.00},
  {name:"Insurance", perMonth:229.00},
  {name:"Bins", perMonth:140.00},
  {name:"Comms", perMonth:140.00},
  {name:"Booking software", perMonth:360.00},
];
