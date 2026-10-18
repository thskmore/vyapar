const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("./public/index.html", "utf8");
const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
let match, count = 0;
let scripts = [];
while ((match = scriptRegex.exec(html)) !== null) {
  count++;
  scripts.push({ id: count, code: match[1] });
}

console.log("Found", scripts.length, "script blocks.");

// Setup mock window/DOM environment
const sandbox = {
  console: console,
  window: {},
  document: {
    getElementById: () => ({ innerHTML: "", style: {}, classList: { add: () => {}, remove: () => {} } }),
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Date: Date,
  Math: Math,
  JSON: JSON,
  parseFloat: parseFloat,
  parseInt: parseInt,
  isNaN: isNaN,
  Object: Object,
  Array: Array,
  String: String,
  Boolean: Boolean
};
sandbox.window = sandbox;

const context = vm.createContext(sandbox);

// Execute each script
scripts.forEach((s) => {
  try {
    vm.runInContext(s.code, context);
    console.log("Script", s.id, "executed successfully");
  } catch (err) {
    console.error("Error executing script", s.id, ":", err.message);
    throw err;
  }
});

// Test mname and bkRows
try {
  const mn = vm.runInContext("mname()", context);
  console.log("mname() returned:", mn);

  // Initialize S and test bkRows
  vm.runInContext("S = { c: [], inv: [], sup: [], bk: [], ob: { Cash: 1000, Bank: 5000, UPI: 200 }, paymodes: [] }; DM = [];", context);
  const rows = vm.runInContext("bkRows()", context);
  console.log("bkRows() returned rows count:", rows.length);

  // Test renderBook0
  vm.runInContext("renderBook0()", context);
  console.log("renderBook0() ran successfully without error!");

  console.log("ALL TESTS PASSED FOR MNAME AND BKROWS!");
} catch (e) {
  console.error("Test execution failed:", e);
  process.exit(1);
}
