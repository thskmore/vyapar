const fs = require("fs");
const code = fs.readFileSync("/tmp/script_3.js", "utf8");

let stack = [];
let inStr = false;
let strChar = "";
let inComment = false;
let inLineComment = false;
let escape = false;

for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const next = code[i+1];
  
  if (inLineComment) {
    if (c === "\n") inLineComment = false;
    continue;
  }
  if (inComment) {
    if (c === "*" && next === "/") { inComment = false; i++; }
    continue;
  }
  if (inStr) {
    if (escape) {
      escape = false;
    } else if (c === "\\") {
      escape = true;
    } else if (c === strChar) {
      inStr = false;
    }
    continue;
  }
  
  if (c === "/" && next === "/") { inLineComment = true; i++; continue; }
  if (c === "/" && next === "*") { inComment = true; i++; continue; }
  if (c === '"' || c === "'" || c === "`") {
    inStr = true;
    strChar = c;
    escape = false;
    continue;
  }
  
  if (c === "(" || c === "{" || c === "[") {
    const line = code.substring(0, i).split("\n").length;
    stack.push({ char: c, line, index: i });
  } else if (c === ")" || c === "}" || c === "]") {
    const line = code.substring(0, i).split("\n").length;
    if (stack.length === 0) {
      console.log(`Unmatched closing ${c} at line ${line}`);
    } else {
      const top = stack.pop();
      const expected = top.char === "(" ? ")" : top.char === "{" ? "}" : "]";
      if (c !== expected) {
        console.log(`Mismatched ${c} at line ${line}, opened ${top.char} at line ${top.line}`);
      }
    }
  }
}

if (inStr) console.log("Unclosed string:", strChar);
if (inComment) console.log("Unclosed block comment");
if (stack.length > 0) {
  console.log(`Unclosed openers (${stack.length}):`, stack.slice(-10).map(s => `${s.char} at script line ${s.line}`));
} else {
  console.log("All matched!");
}
