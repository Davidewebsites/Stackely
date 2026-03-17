const fs = require("fs");

// legge tools.ts
const raw = fs.readFileSync("./app/frontend/src/data/tools.ts", "utf-8");

// trova la parte LOCAL_TOOLS
const marker = raw.indexOf("LOCAL_TOOLS");
if (marker === -1) {
  console.error("LOCAL_TOOLS non trovato");
  process.exit(1);
}

// trova l'inizio dell'array dopo LOCAL_TOOLS
const start = raw.indexOf("[", marker);
const end = raw.lastIndexOf("];");

if (start === -1 || end === -1) {
  console.error("Array non trovato");
  process.exit(1);
}

// estrae solo [ ... ]
const arrayText = raw.slice(start, end + 1);

let tools;
try {
  tools = eval(arrayText);
} catch (err) {
  console.error("Errore nel parsing dell'array:");
  console.error(err.message);
  process.exit(1);
}

if (!Array.isArray(tools) || tools.length === 0) {
  console.error("Nessun tool trovato");
  process.exit(1);
}

const headers = Object.keys(tools[0]);

function escapeCsv(val) {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) return `"${val.join(" | ").replace(/"/g, '""')}"`;
  return `"${String(val).replace(/"/g, '""')}"`;
}

const rows = tools.map(tool =>
  headers.map(h => escapeCsv(tool[h])).join(",")
);

const csv = [headers.join(","), ...rows].join("\n");

fs.writeFileSync("tools.csv", csv);

console.log("✅ tools.csv creato!");
console.log(`Tool esportati: ${tools.length}`);