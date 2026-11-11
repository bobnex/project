# Juvora Clans V1 implementation

Preserve Firebase and existing game flows. Repair tournament API argument mismatches, broken trophy import, spectator state, loading failures and lost administrative match controls first.

Add Discover, My Clan, War Arena, Missions, Leaderboard and Achievements within the existing player shell. Clan headquarters includes members, announcements, audited history, officer tools and manual rewards. No demo clans, uploads or chat.

Use authenticated TanStack server functions and a fetch-based Firestore transaction adapter. Verify Firebase ID tokens, approved player status, exact admin emails and clan hierarchy on the server. A server-only Firebase service-account secret is required; missing credentials fail closed. An additive rules fragment denies direct clan writes without replacing existing game rules.

Creation, membership, names/tags, fees, leadership, war selection, awards, missions and claims commit atomically. Clan wars reuse existing match UI/rules, with server-authoritative answers and transitions for clan-linked matches. Each format runs paired 1v1 rounds whose verified scores aggregate across teams. Store claims and activity IDs to prevent duplicate awards.

Store configurable creation fees, level thresholds/capacity, XP/scoring, mission definitions, achievements/rewards and seasons in settings/clans. Keep purchased wallet balances separate from game coins. Archive season points without deleting permanent progression.

Test concrete acceptance rules, membership/permission boundaries, scoring, mission periods, claims and secret visibility. Authenticated live Firebase checks and rule deployment require owner credentials/access; do not describe those as complete until verified.