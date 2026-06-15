const CONFIG = {
  tournamentStart: '2026-06-11',
  tournamentEnd: '2026-07-19',
  apiEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
  cacheThrottleMinutes: 30,
  personTeams: {
    'Aaron': ['France', 'Japan', 'Scotland'],
    'Ashley': ['Morocco', 'South Korea', 'Iraq'],
    'Brynja': ['Portugal', 'Switzerland', 'Paraguay'],
    'Cristine': ['Senegal', 'Czech Republic', 'DR Congo'],
    'Daisy': ['USA', 'Panama', 'Haiti'],
    'Dave': ['Netherlands', 'Canada', 'Saudi Arabia'],
    'Ingrid': ['Colombia', 'Ecuador', 'Jordan'],
    'José': ['Germany', 'Egypt', 'Uzbekistan'],
    'Julie': ['Uruguay', 'Turkey', 'Tunisia'],
    'Matt': ['Belgium', 'Austria', 'Cape Verde'],
    'Miguel': ['Mexico', 'Norway', 'Bosnia and Herzegovina'],
    'Nate': ['Argentina', 'Ivory Coast', 'South Africa'],
    'Ricardo': ['England', 'Iran', 'Curaçao'],
    'Tahnee': ['Spain', 'Sweden', 'Ghana'],
    'Tanya': ['Croatia', 'Algeria', 'Qatar'],
    'Yvonne': ['Brazil', 'Australia', 'New Zealand']
  },
  teamAliases: {
    'Czech Republic': 'Czechia',
    'DR Congo': 'Congo DR',
    'USA': 'United States',
    'Turkey': 'Türkiye',
    'Bosnia and Herzegovina': 'Bosnia-Herzegovina'
  },
  reverseAliases: {},
  abbrToApiName: {
    'FRA': 'France', 'JPN': 'Japan', 'SCO': 'Scotland',
    'MAR': 'Morocco', 'KOR': 'South Korea', 'IRQ': 'Iraq',
    'POR': 'Portugal', 'SUI': 'Switzerland', 'PAR': 'Paraguay',
    'SEN': 'Senegal', 'CZE': 'Czechia', 'COD': 'Congo DR',
    'USA': 'United States', 'PAN': 'Panama', 'HAI': 'Haiti',
    'NED': 'Netherlands', 'CAN': 'Canada', 'KSA': 'Saudi Arabia',
    'COL': 'Colombia', 'ECU': 'Ecuador', 'JOR': 'Jordan',
    'GER': 'Germany', 'EGY': 'Egypt', 'UZB': 'Uzbekistan',
    'URU': 'Uruguay', 'TUR': 'Türkiye', 'TUN': 'Tunisia',
    'BEL': 'Belgium', 'AUT': 'Austria', 'CPV': 'Cape Verde',
    'MEX': 'Mexico', 'NOR': 'Norway', 'BIH': 'Bosnia-Herzegovina',
    'ARG': 'Argentina', 'CIV': 'Ivory Coast', 'RSA': 'South Africa',
    'ENG': 'England', 'IRN': 'Iran', 'CUW': 'Curaçao',
    'ESP': 'Spain', 'SWE': 'Sweden', 'GHA': 'Ghana',
    'CRO': 'Croatia', 'ALG': 'Algeria', 'QAT': 'Qatar',
    'BRA': 'Brazil', 'AUS': 'Australia', 'NZL': 'New Zealand'
  },
  countryEmoji: {
    'FRA': '🇫🇷', 'JPN': '🇯🇵', 'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'MAR': '🇲🇦', 'KOR': '🇰🇷', 'IRQ': '🇮🇶',
    'POR': '🇵🇹', 'SUI': '🇨🇭', 'PAR': '🇵🇾',
    'SEN': '🇸🇳', 'CZE': '🇨🇿', 'COD': '🇨🇩',
    'USA': '🇺🇸', 'PAN': '🇵🇦', 'HAI': '🇭🇹',
    'NED': '🇳🇱', 'CAN': '🇨🇦', 'KSA': '🇸🇦',
    'COL': '🇨🇴', 'ECU': '🇪🇨', 'JOR': '🇯🇴',
    'GER': '🇩🇪', 'EGY': '🇪🇬', 'UZB': '🇺🇿',
    'URU': '🇺🇾', 'TUR': '🇹🇷', 'TUN': '🇹🇳',
    'BEL': '🇧🇪', 'AUT': '🇦🇹', 'CPV': '🇨🇻',
    'MEX': '🇲🇽', 'NOR': '🇳🇴', 'BIH': '🇧🇦',
    'ARG': '🇦🇷', 'CIV': '🇨🇮', 'RSA': '🇿🇦',
    'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'IRN': '🇮🇷', 'CUW': '🇨🇼',
    'ESP': '🇪🇸', 'SWE': '🇸🇪', 'GHA': '🇬🇭',
    'CRO': '🇭🇷', 'ALG': '🇩🇿', 'QAT': '🇶🇦',
    'BRA': '🇧🇷', 'AUS': '🇦🇺', 'NZL': '🇳🇿'
  },
  teamPerson: {},
  personTeamsLookup: {}
};

CONFIG.personList = Object.keys(CONFIG.personTeams).sort();

for (const [k, v] of Object.entries(CONFIG.teamAliases)) {
  CONFIG.reverseAliases[v] = k;
}

CONFIG.teamAsAbbr = {};
CONFIG.abbrAsTeam = {};
for (const [abbr, apiName] of Object.entries(CONFIG.abbrToApiName)) {
  CONFIG.teamAsAbbr[apiName] = abbr;
  CONFIG.abbrAsTeam[abbr] = apiName;
}

CONFIG.resolveName = function(name) {
  return CONFIG.teamAliases[name] || name;
};

CONFIG.displayName = function(apiName) {
  return CONFIG.reverseAliases[apiName] || apiName;
};

for (const [person, teams] of Object.entries(CONFIG.personTeams)) {
  CONFIG.personTeamsLookup[person] = [];
  for (const t of teams) {
    const apiName = CONFIG.resolveName(t);
    CONFIG.teamPerson[apiName] = person;
    CONFIG.personTeamsLookup[person].push(apiName);
  }
}

CONFIG.getPerson = function(apiTeamName) {
  return CONFIG.teamPerson[apiTeamName] || '';
};

CONFIG.getPersonTeams = function(person) {
  return CONFIG.personTeamsLookup[person] || [];
};

CONFIG.getFlagHTML = function(abbr) {
  const emoji = CONFIG.countryEmoji[abbr] || '';
  return `<span class="flag">${emoji}</span>`;
};

CONFIG.getAbbr = function(teamName) {
  return CONFIG.teamAsAbbr[teamName] || '';
};
