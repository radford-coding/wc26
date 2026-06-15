const APP = {
  data: null,
  teamsMap: {},
  groupsMap: {},
  knockoutGames: [],
  groupGames: {},
  teamIdToAbbr: {},
  currentView: 'games',
  datePickerMin: '2026-06-11',
  datePickerMax: '2026-07-19',

  async init() {
    this.loadFromCache();
    this.loadFromStorage();
    this.setupRouting();
    this.render();
    await this.fetchFromAPI();
  },

  loadFromCache() {
    if (typeof WC_CACHE !== 'undefined' && WC_CACHE && WC_CACHE.games) {
      this.processData(WC_CACHE);
    }
  },

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('wc_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.games && parsed.games.length > 0) {
          const cachedTime = this.data?.timestamp ? new Date(this.data.timestamp) : new Date(0);
          const storedTime = parsed.timestamp ? new Date(parsed.timestamp) : new Date(0);
          if (storedTime > cachedTime) {
            this.processData(parsed);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  },

  saveToStorage(data) {
    try {
      localStorage.setItem('wc_cache', JSON.stringify(data));
    } catch (e) {
      // ignore
    }
  },

  async fetchFromAPI() {
    const lastFetch = localStorage.getItem('wc_last_fetch');
    const now = Date.now();
    const throttleMs = CONFIG.cacheThrottleMinutes * 60 * 1000;

    if (lastFetch && (now - parseInt(lastFetch)) < throttleMs) {
      return false;
    }

    try {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const resp = await fetch(CONFIG.apiEndpoint + '?dates=' + dateStr);
      const d = await resp.json();
      const events = d.events || [];
      if (!events.length) return false;

      const merged = this.mergeApiUpdate(events);
      merged.timestamp = new Date().toISOString();
      this.saveToStorage(merged);
      localStorage.setItem('wc_last_fetch', String(now));
      this.processData(merged);
      this.render();
      return true;
    } catch (e) {
      console.warn('API fetch failed, using cached data');
      return false;
    }
  },

  mergeApiUpdate(freshEvents) {
    const current = this.data ? JSON.parse(JSON.stringify(this.data)) : { timestamp: '', games: [], groups: {}, teams: {} };
    const existingGames = current.games || [];
    const newIds = new Set();

    for (const event of freshEvents) {
      if (!event.competitions || !event.competitions.length) continue;
      const comp = event.competitions[0];
      const gameId = event.id;
      newIds.add(gameId);

      const competitors = (comp.competitors || []).map(c => ({
        homeAway: c.homeAway,
        score: c.score || '0',
        winner: c.winner || false,
        team: {
          id: c.team?.id || '',
          abbreviation: c.team?.abbreviation || '',
          displayName: c.team?.displayName || '',
          name: c.team?.name || '',
          logo: c.team?.logo || ''
        }
      }));

      const statusType = comp.status?.type || {};
      const updatedGame = {
        id: event.id,
        date: event.date,
        name: event.name,
        shortName: event.shortName,
        group: comp.altGameNote || '',
        venue: comp.venue?.fullName || '',
        status: {
          name: statusType.name || '',
          description: statusType.description || '',
          detail: statusType.detail || '',
          state: statusType.state || ''
        },
        competitors,
        competitionId: comp.id || ''
      };

      const idx = existingGames.findIndex(g => g.id === gameId);
      if (idx >= 0) {
        existingGames[idx] = updatedGame;
      } else {
        existingGames.push(updatedGame);
      }
    }

    current.games = existingGames;

    const groups = current.groups || {};
    for (const g of existingGames) {
      const grpNote = g.group;
      if (grpNote.includes('Group')) {
        const grpName = grpNote.replace('FIFA World Cup, ', '');
        if (!groups[grpName]) groups[grpName] = [];
        for (const c of g.competitors) {
          if (!groups[grpName].includes(c.team.displayName)) {
            groups[grpName].push(c.team.displayName);
          }
        }
      }
    }
    current.groups = groups;

    return current;
  },

  apiResponseToCache(apiData) {
    const events = apiData.events || [];
    const games = [];

    for (const event of events) {
      if (!event.competitions || !event.competitions.length) continue;
      const comp = event.competitions[0];
      const competitors = (comp.competitors || []).map(c => ({
        homeAway: c.homeAway,
        score: c.score || '0',
        winner: c.winner || false,
        team: {
          id: c.team?.id || '',
          abbreviation: c.team?.abbreviation || '',
          displayName: c.team?.displayName || '',
          name: c.team?.name || '',
          logo: c.team?.logo || ''
        }
      }));

      const statusType = comp.status?.type || {};
      games.push({
        id: event.id,
        date: event.date,
        name: event.name,
        shortName: event.shortName,
        group: comp.altGameNote || '',
        venue: comp.venue?.fullName || '',
        status: {
          name: statusType.name || '',
          description: statusType.description || '',
          detail: statusType.detail || '',
          state: statusType.state || ''
        },
        competitors,
        competitionId: comp.id || ''
      });
    }

    const groups = {};
    for (const g of games) {
      const grpNote = g.group;
      if (grpNote.includes('Group')) {
        const grpName = grpNote.replace('FIFA World Cup, ', '');
        if (!groups[grpName]) groups[grpName] = [];
        for (const c of g.competitors) {
          if (!groups[grpName].includes(c.team.displayName)) {
            groups[grpName].push(c.team.displayName);
          }
        }
      }
    }

    return { timestamp: new Date().toISOString(), teams: {}, groups, games };
  },

  processData(cache) {
    if (!cache || !cache.games) return;
    this.data = cache;

    this.games = cache.games || [];
    this.groupsMap = cache.groups || {};

    this.teamIdToAbbr = {};
    for (const g of this.games) {
      for (const c of g.competitors) {
        const t = c.team;
        if (t.id && t.abbreviation) {
          this.teamIdToAbbr[t.id] = t.abbreviation;
          CONFIG.abbrAsTeam[t.abbreviation] = t.displayName;
          CONFIG.teamAsAbbr[t.displayName] = t.abbreviation;
        }
      }
    }

    for (const [abbr, name] of Object.entries(CONFIG.abbrAsTeam)) {
      CONFIG.teamAsAbbr[name] = abbr;
    }

    this.groupGames = {};
    this.knockoutGames = [];
    for (const g of this.games) {
      const grp = g.group || '';
      if (grp.includes('Group')) {
        const grpName = grp.replace('FIFA World Cup, ', '');
        if (!this.groupGames[grpName]) this.groupGames[grpName] = [];
        this.groupGames[grpName].push(g);
      } else if (grp !== '') {
        this.knockoutGames.push(g);
      } else if (g.competitors.length === 2) {
        const t1 = g.competitors[0].team.displayName;
        const t2 = g.competitors[1].team.displayName;
        const isPlaceholder = /^\d/.test(t1) || /^\d/.test(t2) || t1.includes('RD') || t2.includes('RD');
        if (isPlaceholder) {
          this.knockoutGames.push(g);
        }
      }
    }

    this.knockoutGames.sort((a, b) => new Date(a.date) - new Date(b.date));

    this.gamesByDate = {};
    for (const g of this.games) {
      const d = this.pacificDateStr(g.date);
      if (!this.gamesByDate[d]) this.gamesByDate[d] = [];
      this.gamesByDate[d].push(g);
    }

    this.updateStatusBar();
  },

  setupRouting() {
    window.addEventListener('hashchange', () => this.render());
    window.addEventListener('popstate', () => this.render());
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-nav]');
      if (link) {
        e.preventDefault();
        window.location.hash = link.getAttribute('data-nav');
      }
      const teamLink = e.target.closest('[data-team]');
      if (teamLink) {
        e.preventDefault();
        const teamName = teamLink.getAttribute('data-team');
        window.location.hash = `schedule?team=${encodeURIComponent(teamName)}`;
      }
      const personLink = e.target.closest('[data-person]');
      if (personLink) {
        e.preventDefault();
        const personName = personLink.getAttribute('data-person');
        window.location.hash = `schedule?person=${encodeURIComponent(personName)}`;
      }
    });
  },

  parseHash() {
    const hash = window.location.hash.slice(1) || 'games';
    const parts = hash.split('?');
    const view = parts[0];
    const params = {};
    if (parts[1]) {
      for (const pair of parts[1].split('&')) {
        const [k, v] = pair.split('=');
        params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
    return { view, params };
  },

  render() {
    const { view, params } = this.parseHash();
    this.currentView = view;

    document.querySelectorAll('nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-nav') === view);
    });

    const container = document.getElementById('view-container');
    container.innerHTML = '';

    switch (view) {
      case 'teams': this.renderTeams(container, params); break;
      case 'standings': this.renderStandings(container, params); break;
      case 'schedule': this.renderSchedule(container, params); break;
      default: this.renderGames(container, params); break;
    }
  },

  updateStatusBar() {
    const el = document.getElementById('status-text');
    if (!el) return;
    if (!this.data || !this.data.timestamp) {
      el.textContent = 'No cached data';
      return;
    }
    const then = new Date(this.data.timestamp);
    const now = new Date();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) el.textContent = 'Updated just now';
    else if (diffMin < 60) el.textContent = `Updated ${diffMin}m ago`;
    else el.textContent = `Updated ${Math.floor(diffMin / 60)}h ${diffMin % 60}m ago`;
  },

  pacificDateStr(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const parts = d.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const [m, day, y] = parts.split('/');
    return `${y}-${m}-${day}`;
  },

  formatPacificTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      hour12: true
    });
  },

  formatPacificDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'short', month: 'short', day: 'numeric'
    });
  },

  formatPacificTimeOnly(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric', minute: '2-digit',
      hour12: true
    });
  },

  getGameStatus(game) {
    const s = game.status;
    if (s.name === 'STATUS_FULL_TIME' || s.state === 'post') return 'final';
    if (s.name === 'STATUS_IN_PROGRESS' || s.name === 'STATUS_FIRST_HALF' ||
        s.name === 'STATUS_SECOND_HALF' || s.name === 'STATUS_HALFTIME') return 'live';
    return 'scheduled';
  },

  getGameShortStatus(game) {
    const s = game.status;
    const detail = s.detail || '';
    if (s.name === 'STATUS_FULL_TIME' || s.state === 'post') return 'FT';
    if (s.name === 'STATUS_IN_PROGRESS' || s.name === 'STATUS_SECOND_HALF') return detail || '2nd';
    if (s.name === 'STATUS_FIRST_HALF') return detail || '1st';
    if (s.name === 'STATUS_HALFTIME') return 'HT';
    return this.formatPacificTimeOnly(game.date);
  },

  getGroupStandings(groupName) {
    const games = this.groupGames[groupName] || [];
    const teams = this.groupsMap[groupName] || [];
    const stats = {};

    for (const t of teams) {
      stats[t] = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    }

    for (const g of games) {
      if (g.status.name !== 'STATUS_FULL_TIME' && g.status.state !== 'post') continue;
      const [t1, t2] = g.competitors;
      if (!t1 || !t2) continue;
      const n1 = t1.team.displayName;
      const n2 = t2.team.displayName;
      const s1 = parseInt(t1.score) || 0;
      const s2 = parseInt(t2.score) || 0;

      if (!stats[n1] || !stats[n2]) continue;

      stats[n1].played++;
      stats[n2].played++;
      stats[n1].gf += s1;
      stats[n1].ga += s2;
      stats[n2].gf += s2;
      stats[n2].ga += s1;

      if (s1 > s2) {
        stats[n1].wins++; stats[n1].pts += 3;
        stats[n2].losses++;
      } else if (s2 > s1) {
        stats[n2].wins++; stats[n2].pts += 3;
        stats[n1].losses++;
      } else {
        stats[n1].draws++; stats[n1].pts += 1;
        stats[n2].draws++; stats[n2].pts += 1;
      }
    }

    for (const [t, s] of Object.entries(stats)) {
      s.gd = s.gf - s.ga;
    }

    return Object.entries(stats)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.name.localeCompare(b.name);
      });
  },

  getTeamAbbr(teamName) {
    return CONFIG.teamAsAbbr[teamName] || teamName.toUpperCase().slice(0, 3);
  },

  getTeamFlagHTML(teamName) {
    const abbr = this.getTeamAbbr(teamName);
    return CONFIG.getFlagHTML(abbr);
  },

  teamAndPersonHTML(teamApiName, opts = {}) {
    const displayName = CONFIG.displayName(teamApiName);
    const person = CONFIG.getPerson(teamApiName);
    const abbr = this.getTeamAbbr(teamApiName);
    const flag = CONFIG.getFlagHTML(abbr);
    const cls = opts.className ? ` class="${opts.className}"` : '';
    const winnerCls = opts.winner !== undefined ? (opts.winner ? ' winner' : ' loser') : '';

    return `<span${cls}>
      ${flag}
      <span class="team-info">
        <a href="#" data-team="${teamApiName}" class="team-name${winnerCls}">${displayName}</a>
        ${person ? `<a href="#" data-person="${person}" class="person-name">${person}</a>` : ''}
      </span>
    </span>`;
  },

  makeTeamBadge(teamApiName, points) {
    const displayName = CONFIG.displayName(teamApiName);
    const abbr = this.getTeamAbbr(teamApiName);
    const flag = CONFIG.getFlagHTML(abbr);
    return `<span class="team-badge" data-team="${teamApiName}">
      ${flag} ${displayName} <span class="badge-pts">${points}</span>
    </span>`;
  },

  // ===================== GAMES VIEW =====================
  renderGames(container, params) {
    container.innerHTML = `<div class="view-title">Games</div>
      <div class="controls">
        <label for="game-date">Date</label>
        <div class="date-nav-wrap">
          <button class="date-nav-btn" id="date-prev" aria-label="Previous day">‹</button>
          <input type="date" id="game-date" min="${this.datePickerMin}" max="${this.datePickerMax}">
          <button class="date-nav-btn" id="date-next" aria-label="Next day">›</button>
        </div>
      </div>
      <div id="games-list" class="game-list"></div>`;

    const input = document.getElementById('game-date');
    const prevBtn = document.getElementById('date-prev');
    const nextBtn = document.getElementById('date-next');
    const today = this.pacificDateStr(new Date().toISOString());
    const clamped = today < this.datePickerMin ? this.datePickerMin :
      today > this.datePickerMax ? this.datePickerMax : today;
    input.value = params.date || clamped;

    const go = (d) => window.location.hash = `games?date=${d}`;

    input.addEventListener('change', () => go(input.value));

    const shiftDay = (offset) => {
      const [y, m, d] = input.value.split('-').map(Number);
      const dt = new Date(y, m - 1, d + offset);
      const s = dt.toISOString().slice(0, 10);
      if (s >= this.datePickerMin && s <= this.datePickerMax) go(s);
    };

    prevBtn.addEventListener('click', () => shiftDay(-1));
    nextBtn.addEventListener('click', () => shiftDay(1));

    this.renderGamesForDate(input.value);
  },

  renderGamesForDate(dateStr) {
    const list = document.getElementById('games-list');
    if (!list) return;
    if (!this.gamesByDate) {
      list.innerHTML = `<div class="empty-state"><p>Loading game data...</p></div>`;
      return;
    }

    const games = this.gamesByDate[dateStr];
    if (!games || !games.length) {
      list.innerHTML = `<div class="empty-state"><p>No games scheduled for ${dateStr}</p></div>`;
      return;
    }

    games.sort((a, b) => new Date(a.date) - new Date(b.date));

    list.innerHTML = games.map(g => {
      const [t1, t2] = g.competitors;
      if (!t1 || !t2) return '';
      const status = this.getGameStatus(g);
      const statusText = this.getGameShortStatus(g);
      const s1 = ['final', 'live'].includes(status) ? t1.score : '-';
      const s2 = ['final', 'live'].includes(status) ? t2.score : '-';
      const groupLabel = g.group.replace('FIFA World Cup, ', '');
      const pt = this.formatPacificTimeOnly(g.date);
      const pd = this.formatPacificDate(g.date);

      return `<div class="game-card">
        <div class="game-meta">
          <span>${pd} · ${pt}</span>
          <span class="game-status ${status}">${status === 'final' ? 'Final' : status === 'live' ? statusText : groupLabel}</span>
        </div>
        <div class="game-matchup">
          <div class="team-block">
            ${this.teamAndPersonHTML(t1.team.displayName, { winner: t1.winner })}
          </div>
          <div class="score">${s1}</div>
          <div class="score-divider">vs</div>
          <div class="score">${s2}</div>
          <div class="team-block right">
            ${this.teamAndPersonHTML(t2.team.displayName, { winner: t2.winner })}
          </div>
        </div>
        ${g.venue ? `<div class="game-venue">${g.venue} - </div>` : ''}
      </div>`;
    }).join('');
  },

  // ===================== TEAMS VIEW =====================
  renderTeams(container, params) {
    const hasKnockout = this.knockoutGames.length > 0;
    const isKnockoutTime = new Date() >= new Date('2026-06-28');

    container.innerHTML = `<div class="view-title">Teams</div>`;

    if (hasKnockout && isKnockoutTime) {
      this.renderBracketView(container);
    } else {
      this.renderGroupView(container);
    }
  },

  renderGroupView(container) {
    let html = '';
    const sortedGroups = Object.keys(this.groupsMap).sort();

    for (const grpName of sortedGroups) {
      const standings = this.getGroupStandings(grpName);
      html += `<div class="group-section">
        <div class="group-title">${grpName}</div>
        <table class="group-table">
          <colgroup>
            <col class="col-team">
            <col class="col-stat">
            <col class="col-stat">
            <col class="col-stat">
            <col class="col-stat">
            <col class="col-stat">
            <col class="col-stat">
            <col class="col-stat">
            <col class="col-pts">
          </colgroup>
          <thead><tr>
            <th>Team</th>
            <th style="text-align:center">P</th>
            <th style="text-align:center">W</th>
            <th style="text-align:center">D</th>
            <th style="text-align:center">L</th>
            <th style="text-align:center">GF</th>
            <th style="text-align:center">GA</th>
            <th style="text-align:center">GD</th>
            <th class="pts">Pts</th>
          </tr></thead>
          <tbody>`;

      for (const t of standings) {
        const apiName = t.name;
        const displayName = CONFIG.displayName(apiName);
        const person = CONFIG.getPerson(apiName);
        const abbr = this.getTeamAbbr(apiName);
        const flag = CONFIG.getFlagHTML(abbr);

        html += `<tr class="team-row">
          <td>
            <div class="team-cell">
              ${flag}
              <div class="team-info">
                <a href="#" data-team="${apiName}" class="team-name">${displayName}</a>
                ${person ? `<a href="#" data-person="${person}" class="person-name">${person}</a>` : ''}
              </div>
            </div>
          </td>
          <td class="c-stat">${t.played}</td>
          <td class="c-stat">${t.wins}</td>
          <td class="c-stat">${t.draws}</td>
          <td class="c-stat">${t.losses}</td>
          <td class="c-stat">${t.gf}</td>
          <td class="c-stat">${t.ga}</td>
          <td class="c-stat">${t.gd > 0 ? '+' : ''}${t.gd}</td>
          <td class="c-pts">${t.pts}</td>
        </tr>`;
      }

      html += `</tbody></table></div>`;
    }

    container.innerHTML += html;
  },

  renderBracketView(container) {
    const rounds = [
      { key: 'round32', label: 'Round of 32', start: '2026-06-28', end: '2026-07-03' },
      { key: 'round16', label: 'Round of 16', start: '2026-07-04', end: '2026-07-07' },
      { key: 'quarter', label: 'Quarterfinals', start: '2026-07-09', end: '2026-07-11' },
      { key: 'semi', label: 'Semifinals', start: '2026-07-14', end: '2026-07-15' },
      { key: 'third', label: '3rd Place', start: '2026-07-18', end: '2026-07-18' },
      { key: 'final', label: 'Final', start: '2026-07-19', end: '2026-07-19' }
    ];

    let html = `<div class="bracket-view">`;
    const now = new Date();

    for (const round of rounds) {
      const roundStart = new Date(round.start + 'T00:00:00Z');
      const roundEnd = new Date(round.end + 'T23:59:00Z');
      const roundGames = this.knockoutGames.filter(g => {
        const d = new Date(g.date);
        return d >= roundStart && d <= roundEnd;
      });

      if (roundGames.length === 0) {
        if (now < roundStart) {
          html += `<div class="bracket-round">
            <div class="bracket-round-title">${round.label}</div>
            <div class="empty-state"><p>Upcoming</p></div>
          </div>`;
        }
        continue;
      }

      html += `<div class="bracket-round">
        <div class="bracket-round-title">${round.label}</div>
        <div class="bracket-matches">`;

      for (const g of roundGames) {
        const [t1, t2] = g.competitors;
        const status = this.getGameStatus(g);
        const s1 = status !== 'scheduled' ? t1.score : '';
        const s2 = status !== 'scheduled' ? t2.score : '';
        const isDone = status === 'final';

        const team1Name = t1.team.displayName;
        const team2Name = t2.team.displayName;
        const isTbd1 = /^\d|^RD|^QF|^SF/.test(team1Name);
        const isTbd2 = /^\d|^RD|^QF|^SF/.test(team2Name);
        const disp1 = isTbd1 ? 'TBD' : team1Name;
        const disp2 = isTbd2 ? 'TBD' : team2Name;

        html += `<div class="bracket-match">
          <div class="bracket-team ${isDone && t1.winner ? '' : 'loser'}">
            ${isTbd1 ? `<span class="bracket-tbd">${disp1}</span>` : `
              ${CONFIG.getFlagHTML(this.getTeamAbbr(team1Name))}
              <span class="team-info">
                <a href="#" data-team="${team1Name}" class="team-name">${CONFIG.displayName(team1Name)}</a>
                ${CONFIG.getPerson(team1Name) ? `<a href="#" data-person="${CONFIG.getPerson(team1Name)}" class="person-name">${CONFIG.getPerson(team1Name)}</a>` : ''}
              </span>`}
          </div>
          <div class="bracket-score">${s1}</div>
          <div class="bracket-vs">-</div>
          <div class="bracket-score">${s2}</div>
          <div class="bracket-team ${isDone && t2.winner ? '' : 'loser'}">
            ${isTbd2 ? `<span class="bracket-tbd">${disp2}</span>` : `
              ${CONFIG.getFlagHTML(this.getTeamAbbr(team2Name))}
              <span class="team-info">
                <a href="#" data-team="${team2Name}" class="team-name">${CONFIG.displayName(team2Name)}</a>
                ${CONFIG.getPerson(team2Name) ? `<a href="#" data-person="${CONFIG.getPerson(team2Name)}" class="person-name">${CONFIG.getPerson(team2Name)}</a>` : ''}
              </span>`}
          </div>
        </div>`;
      }

      html += `</div></div>`;
    }

    html += `</div>`;

    if (!html.includes('bracket-round')) {
      html = `<div class="empty-state"><p>No knockout stage data available yet.</p></div>`;
    }

    container.innerHTML += html;
  },

  // ===================== STANDINGS VIEW =====================
  renderStandings(container, params) {
    container.innerHTML = `<div class="view-title">Standings</div>`;

    const rows = this.computePersonStandings();
    if (rows.length === 0) {
      container.innerHTML += `<div class="empty-state"><p>No standings data available.</p></div>`;
      return;
    }

    const ranked = this.applyCompetitionRanking(rows);

    let html = `<table class="standings-table">
      <thead><tr>
        <th class="num">#</th>
        <th>Person</th>
        <th>Teams</th>
        <th class="num">Pts</th>
      </tr></thead><tbody>`;

    for (const r of ranked) {
      const sorted = [...r.teams].sort((a, b) => b.points - a.points);
      const teamsHtml = sorted.map(t => {
        return this.makeTeamBadge(t.apiName, t.points);
      }).join('');

      html += `<tr>
        <td class="rank">${r.rankDisplay}</td>
        <td class="person-name"><a href="#" data-person="${r.person}" class="team-name">${r.person}</a></td>
        <td><div class="team-cell-wrap">${teamsHtml}</div></td>
        <td class="total-pts">${r.totalPts}</td>
      </tr>`;
    }

    html += `</tbody></table>`;
    container.innerHTML += html;
  },

  computePersonStandings() {
    const results = [];

    for (const person of CONFIG.personList) {
      const teams = CONFIG.getPersonTeams(person);
      let totalPts = 0;
      const teamInfos = [];

      for (const apiName of teams) {
        const info = this.getTeamStandingsInfo(apiName);
        totalPts += info.points;
        teamInfos.push(info);
      }

      results.push({ person, totalPts, teams: teamInfos });
    }

    results.sort((a, b) => b.totalPts - a.totalPts);
    return results;
  },

  getTeamStandingsInfo(apiName) {
    let points = 0;
    const abbr = this.getTeamAbbr(apiName);
    let eliminated = true;
    let alive = false;

    const grpStandings = this.findGroupForTeam(apiName);
    if (grpStandings) {
      const found = grpStandings.find(t => t.name === apiName);
      if (found) {
        points += found.pts || 0;
        const numTeams = grpStandings.length;
        const topAdvance = Math.min(2, numTeams);
        const thirdPlaceAdvance = true; // 8/12 third places advance
        if (found.played > 0 && found.played === numTeams - 1) {
          const rank = grpStandings.indexOf(found) + 1;
          if (rank <= topAdvance || rank === 3) {
            alive = true;
            eliminated = false;
          } else {
            eliminated = true;
          }
        } else if (found.played > 0) {
          alive = true;
          eliminated = false;
        }
      }
    }

    const knockResults = this.getTeamKnockoutResults(apiName);
    for (const kr of knockResults) {
      if (kr.won) {
        points += 5;
        alive = true;
        eliminated = false;
      } else if (kr.lost) {
        eliminated = true;
        alive = false;
      } else {
        alive = true;
        eliminated = false;
      }
    }

    if (alive && !eliminated) {
      if (knockResults.length === 0 && grpStandings && grpStandings.some(t => t.name === apiName && t.played > 0)) {
        // still in group stage
      }
    }

    const displayName = CONFIG.displayName(apiName);

    return { apiName, displayName, abbr, points, eliminated, alive };
  },

  findGroupForTeam(apiName) {
    for (const [grpName, teams] of Object.entries(this.groupsMap)) {
      if (teams.includes(apiName)) {
        return this.getGroupStandings(grpName);
      }
    }
    return null;
  },

  getTeamKnockoutResults(apiName) {
    const results = [];
    for (const g of this.knockoutGames) {
      const [t1, t2] = g.competitors;
      if (!t1 || !t2) continue;

      let ourComp = null;
      let oppComp = null;
      if (t1.team.displayName === apiName) { ourComp = t1; oppComp = t2; }
      else if (t2.team.displayName === apiName) { ourComp = t2; oppComp = t1; }
      else if (t1.team.displayName.includes(apiName) || apiName.includes(t1.team.displayName)) {
        // partial match for placeholder resolution
      }

      if (ourComp && oppComp) {
        const isFinal = g.status.name === 'STATUS_FULL_TIME' || g.status.state === 'post';
        const won = isFinal && ourComp.winner;
        const lost = isFinal && !ourComp.winner && parseInt(oppComp.score) !== parseInt(ourComp.score);
        results.push({ game: g, won, lost, isFinal });
      }
    }
    return results;
  },

  applyCompetitionRanking(rows) {
    const ranked = [];
    let currentRank = 1;

    for (let i = 0; i < rows.length; i++) {
      const prev = rows[i - 1];
      const r = { ...rows[i] };

      if (i > 0 && r.totalPts < prev.totalPts) {
        currentRank = i + 1;
      }

      r.rankDisplay = String(currentRank);
      ranked.push(r);
    }

    return ranked;
  },

  // ===================== SCHEDULE VIEW =====================
  renderSchedule(container, params) {
    container.innerHTML = `<div class="view-title">Schedule</div>
      <div class="controls">
        <label for="schedule-type">View by</label>
        <select id="schedule-type">
          <option value="team">Team</option>
          <option value="person">Person</option>
        </select>
        <select id="schedule-select"></select>
      </div>
      <div id="schedule-list" class="schedule-list"></div>`;

    const typeEl = document.getElementById('schedule-type');
    const selectEl = document.getElementById('schedule-select');

    const type = params.team ? 'team' : params.person ? 'person' : 'team';
    typeEl.value = type;

    this.populateScheduleSelect(type, selectEl, params);

    typeEl.addEventListener('change', () => {
      this.populateScheduleSelect(typeEl.value, selectEl, {});
      this.renderScheduleList(selectEl.value, typeEl.value);
    });

    selectEl.addEventListener('change', () => {
      const type = typeEl.value;
      const val = selectEl.value;
      if (type === 'team') {
        window.location.hash = `schedule?team=${encodeURIComponent(val)}`;
      } else {
        window.location.hash = `schedule?person=${encodeURIComponent(val)}`;
      }
    });

    this.renderScheduleList(selectEl.value, typeEl.value);
  },

  populateScheduleSelect(type, selectEl, params) {
    const defaultTeam = 'United States';
    const raw = type === 'team' ? (params.team || defaultTeam) : (params.person || 'Daisy');
    const selected = type === 'team' ? CONFIG.resolveName(raw) : raw;

    let options = [];
    if (type === 'team') {
      const realTeams = new Set();
      for (const grpTeams of Object.values(this.groupsMap)) {
        for (const t of grpTeams) realTeams.add(t);
      }
      if (realTeams.size === 0) {
        CONFIG.personList.flatMap(p => CONFIG.getPersonTeams(p)).forEach(t => realTeams.add(t));
      }
      options = Array.from(realTeams).sort();
    } else {
      options = CONFIG.personList;
    }

    selectEl.innerHTML = options.map(v =>
      `<option value="${v}" ${v === selected ? 'selected' : ''}>${type === 'team' ? CONFIG.displayName(v) : v}</option>`
    ).join('');
  },

  renderScheduleList(selected, type) {
    const list = document.getElementById('schedule-list');
    if (!list) return;

    let games = [];

    if (type === 'person') {
      const teams = CONFIG.getPersonTeams(selected);
      const teamNames = new Set(teams);
      games = this.games.filter(g => {
        return g.competitors.some(c => teamNames.has(c.team.displayName));
      });
    } else {
      const apiName = CONFIG.resolveName(selected);
      games = this.games.filter(g => {
        return g.competitors.some(c => c.team.displayName === apiName);
      });
    }

    if (!games.length) {
      list.innerHTML = `<div class="empty-state"><p>No games found for ${type === 'person' ? selected : CONFIG.displayName(selected)}.</p></div>`;
      return;
    }

    games.sort((a, b) => new Date(a.date) - new Date(b.date));

    const title = type === 'person' ? selected : CONFIG.displayName(selected);
    list.innerHTML = games.map(g => {
      const [t1, t2] = g.competitors;
      const status = this.getGameStatus(g);
      const statusText = this.getGameShortStatus(g);
      const s1 = status !== 'scheduled' ? t1.score : '–';
      const s2 = status !== 'scheduled' ? t2.score : '–';
      const pd = this.formatPacificDate(g.date);
      const pt = this.formatPacificTimeOnly(g.date);
      const groupLabel = g.group.replace('FIFA World Cup, ', '');

      const isTeam1 = t1.team.displayName === selected ||
        (type === 'person' && CONFIG.getPerson(t1.team.displayName) === selected);
      const isTeam2 = t2.team.displayName === selected ||
        (type === 'person' && CONFIG.getPerson(t2.team.displayName) === selected);

      const gameDate = this.pacificDateStr(g.date);
      return `<div class="schedule-item">
        <span class="schedule-date"><a href="#games?date=${gameDate}" class="date-link">${pd}</a><br><span style="font-size:0.72rem;color:var(--text-dim)">${pt}</span></span>
        <span class="schedule-status ${status}">${status === 'final' ? 'FT' : status === 'live' ? statusText : groupLabel}</span>
        <span class="schedule-teams">
          <span class="team-block">
            ${this.getTeamFlagHTML(t1.team.displayName)}
            <span class="team-info">
              <a href="#" data-team="${t1.team.displayName}" class="team-name ${isTeam1 ? 'highlight' : ''}">${CONFIG.displayName(t1.team.displayName)}</a>
              ${CONFIG.getPerson(t1.team.displayName) ? `<a href="#" data-person="${CONFIG.getPerson(t1.team.displayName)}" class="person-name">${CONFIG.getPerson(t1.team.displayName)}</a>` : ''}
            </span>
          </span>
          <span style="color:var(--text-dim)">vs</span>
          <span class="team-block">
            ${this.getTeamFlagHTML(t2.team.displayName)}
            <span class="team-info">
              <a href="#" data-team="${t2.team.displayName}" class="team-name ${isTeam2 ? 'highlight' : ''}">${CONFIG.displayName(t2.team.displayName)}</a>
              ${CONFIG.getPerson(t2.team.displayName) ? `<a href="#" data-person="${CONFIG.getPerson(t2.team.displayName)}" class="person-name">${CONFIG.getPerson(t2.team.displayName)}</a>` : ''}
            </span>
          </span>
        </span>
        <span class="schedule-score">${s1}–${s2}</span>
      </div>`;
    }).join('');
  }
};

document.addEventListener('DOMContentLoaded', () => APP.init());
