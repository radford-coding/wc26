#!/usr/bin/env python3
"""Fetch all World Cup data from ESPN API and generate cache.js"""
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
import sys
import os

API = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
TEAMS_API = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams"
START = "2026-06-11"
END = "2026-07-19"

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None

def main():
    # Fetch all teams
    print("Fetching teams...", file=sys.stderr)
    teams_data = fetch(TEAMS_API)
    teams = {}
    if teams_data and 'sports' in teams_data:
        for sport in teams_data['sports']:
            for league in sport.get('leagues', []):
                for t in league.get('teams', []):
                    team = t['team']
                    abbr = team.get('abbreviation', '')
                    teams[abbr] = {
                        'id': team.get('id', ''),
                        'name': team.get('displayName', ''),
                        'shortName': team.get('shortDisplayName', ''),
                        'abbreviation': abbr,
                        'logo': team.get('logo', ''),
                        'color': team.get('color', ''),
                    }

    print(f"Found {len(teams)} teams", file=sys.stderr)

    # Fetch games for each date
    all_events = []
    start_dt = datetime.strptime(START, "%Y-%m-%d")
    end_dt = datetime.strptime(END, "%Y-%m-%d")
    current = start_dt
    date_strs = []
    while current <= end_dt:
        date_strs.append(current.strftime("%Y%m%d"))
        current += timedelta(days=1)

    for i, ds in enumerate(date_strs):
        date_display = f"{ds[:4]}-{ds[4:6]}-{ds[6:]}"
        url = f"{API}?dates={ds}"
        print(f"[{i+1}/{len(date_strs)}] Fetching {date_display}...", file=sys.stderr)
        data = fetch(url)
        if data and 'events' in data:
            for event in data['events']:
                if 'competitions' in event and len(event['competitions']) > 0:
                    comp = event['competitions'][0]
                    competitors = []
                    for c in comp.get('competitors', []):
                        team = c.get('team', {})
                        competitors.append({
                            'id': c.get('id', ''),
                            'homeAway': c.get('homeAway', ''),
                            'score': c.get('score', '0'),
                            'winner': c.get('winner', False),
                            'team': {
                                'id': team.get('id', ''),
                                'abbreviation': team.get('abbreviation', ''),
                                'displayName': team.get('displayName', ''),
                                'shortDisplayName': team.get('shortDisplayName', ''),
                                'name': team.get('name', ''),
                                'logo': team.get('logo', ''),
                            }
                        })
                    status = comp.get('status', {}).get('type', {})
                    all_events.append({
                        'id': event.get('id', ''),
                        'date': event.get('date', ''),
                        'name': event.get('name', ''),
                        'shortName': event.get('shortName', ''),
                        'group': comp.get('altGameNote', ''),
                        'venue': comp.get('venue', {}).get('fullName', ''),
                        'status': {
                            'name': status.get('name', ''),
                            'description': status.get('description', ''),
                            'detail': status.get('detail', ''),
                            'state': status.get('state', ''),
                        },
                        'competitors': competitors,
                        'season': event.get('season', {}),
                        'competitionId': comp.get('id', ''),
                    })
    print(f"Total events: {len(all_events)}", file=sys.stderr)

    # Extract groups from events
    groups = {}
    for ev in all_events:
        grp_note = ev.get('group', '')
        if 'Group' in grp_note:
            grp_name = grp_note.replace('FIFA World Cup, ', '')
            if grp_name not in groups:
                groups[grp_name] = []
            for comp in ev.get('competitors', []):
                tn = comp['team']['displayName']
                if tn not in groups[grp_name]:
                    groups[grp_name].append(tn)

    # Sort groups alphabetically
    sorted_groups = {}
    for g in sorted(groups.keys()):
        sorted_groups[g] = groups[g]

    # Add known groups for teams not yet seen in group games
    # (some teams may not have played yet)
    all_seen_teams = set()
    for ev in all_events:
        for comp in ev.get('competitors', []):
            all_seen_teams.add(comp['team']['displayName'])

    # If a team is in our config but not seen (shouldn't happen with full fetch)
    # We fill from our known mapping
    known_team_abbrs = [t['abbreviation'] for t in teams.values()]

    now = datetime.now(timezone.utc).isoformat()
    cache = {
        'timestamp': now,
        'teams': teams,
        'groups': sorted_groups,
        'games': all_events,
        'eventCount': len(all_events),
        'teamCount': len(teams),
    }

    # Write cache.js
    js_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'js', 'cache.js')
    js_content = f"""// World Cup Cache - Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC
// ESPN API - FIFA World Cup 2026
var WC_CACHE = {json.dumps(cache, indent=2)};
"""
    with open(js_path, 'w') as f:
        f.write(js_content)
    print(f"Written cache.js ({len(js_content)} bytes)", file=sys.stderr)

    # Write summary
    print(f"\nCache Summary:", file=sys.stderr)
    print(f"  Teams: {len(teams)}", file=sys.stderr)
    print(f"  Groups: {len(sorted_groups)}", file=sys.stderr)
    print(f"  Games: {len(all_events)}", file=sys.stderr)
    print(f"  Timestamp: {now}", file=sys.stderr)

if __name__ == '__main__':
    main()
