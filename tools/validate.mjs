import fs from 'fs';
const configSrc = fs.readFileSync('js/config.js', 'utf8');
const cacheSrc = fs.readFileSync('js/cache.js', 'utf8');
const combined = configSrc + '\n' + cacheSrc;

// Extract JSON from the var assignment in cache.js
const jsonMatch = cacheSrc.match(/\{[\s\S]*\}/);
const cacheData = JSON.parse(jsonMatch[0]);

// Evaluate config to get CONFIG
const configMatch = configSrc.match(/const CONFIG = \{[\s\S]*?\};/);
eval(configSrc);

const allTeams = new Set();
for (const [grp, teams] of Object.entries(cacheData.groups)) {
  teams.forEach(t => allTeams.add(t));
}
console.log('Unique teams in groups:', allTeams.size);

let missing = [];
for (const t of allTeams) {
  if (!CONFIG.teamAsAbbr[t]) missing.push(t);
}
if (missing.length > 0) {
  console.log('Teams missing abbreviations:', missing);
} else {
  console.log('All teams have abbreviations OK');
}

// Check that all person teams are in the cache
let missingTeams = [];
for (const [person, teams] of Object.entries(CONFIG.personTeams)) {
  for (const t of teams) {
    const apiName = CONFIG.resolveName(t);
    if (!allTeams.has(apiName)) {
      missingTeams.push(`${person}: ${t} (${apiName})`);
    }
  }
}
if (missingTeams.length > 0) {
  console.log('Person teams not in cache:', missingTeams);
} else {
  console.log('All person teams found in cache OK');
}

console.log('Groups:', Object.keys(cacheData.groups).length);
console.log('Games:', cacheData.games.length);
console.log('Timestamp:', cacheData.timestamp);
