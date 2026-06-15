const fs = require('fs');
const configSrc = fs.readFileSync('js/config.js', 'utf8');
const cacheSrc = fs.readFileSync('js/cache.js', 'utf8');

// Extract JSON from cache.js
const jsonMatch = cacheSrc.match(/\{[\s\S]*\}/);
const cacheData = JSON.parse(jsonMatch[0]);

// Eval config in non-strict context to make CONFIG global
const script = configSrc.replace(/^const CONFIG =/, 'CONFIG =') + '\n' +
  'var allTeams = new Set();\n' +
  'for (const [grp, teams] of Object.entries(WC_CACHE.groups)) {\n' +
  '  teams.forEach(t => allTeams.add(t));\n' +
  '}\n' +
  'console.log("Unique teams in groups:", allTeams.size);\n' +
  'var missing = [];\n' +
  'for (const t of allTeams) {\n' +
  '  if (!CONFIG.teamAsAbbr[t]) missing.push(t);\n' +
  '}\n' +
  'if (missing.length > 0) {\n' +
  '  console.log("Teams missing abbreviations:", missing);\n' +
  '} else {\n' +
  '  console.log("All teams have abbreviations OK");\n' +
  '}\n' +
  'var missingTeams = [];\n' +
  'for (const [person, teams] of Object.entries(CONFIG.personTeams)) {\n' +
  '  for (const t of teams) {\n' +
  '    var apiName = CONFIG.resolveName(t);\n' +
  '    if (!allTeams.has(apiName)) {\n' +
  '      missingTeams.push(person + ": " + t + " (" + apiName + ")");\n' +
  '    }\n' +
  '  }\n' +
  '}\n' +
  'if (missingTeams.length > 0) {\n' +
  '  console.log("Person teams not in cache:", missingTeams);\n' +
  '} else {\n' +
  '  console.log("All person teams found in cache OK");\n' +
  '}\n' +
  'console.log("Groups:", Object.keys(cacheData.groups).length);\n' +
  'console.log("Games:", cacheData.games.length);\n' +
  'console.log("Timestamp:", cacheData.timestamp);\n';

const vm = require('vm');
const context = { WC_CACHE: cacheData, console };
vm.createContext(context);
vm.runInContext(script, context);
