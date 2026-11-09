# Favoje Battle roadmap

Current request:
- Repair rank updates, ranked settings and the admin AI question generator; verify affected rules and flows.
- Global SFX admin toggle: master switch in Admin settings to mute all sound effects platform-wide; when off, hide/disable the player sound toggle.
- Tournament team mode: admin-configurable teams (count, names, colors, roster size), allocation (random / RP-balanced / player choice / manual), scoring rule (total points / average / head-to-head wins), team standings tab, roster view, team tags in brackets and match listings.

Done: solo CBT mode (timed courses, admin CBT tab), themes (15 × dark/light), app layout, sign-up/login/reset, home, 1v1 matchmaking, private rooms, 50 Players Rush, live battle + results, rankings, friends + challenges, notifications, profile, settings, admin (questions, players, app settings), multi-course picking in battle and tournament course selectors.

Open:
- Firebase console setup (enable Email sign-in, create Firestore, add preview domain to authorized domains, publish security rules, create first admin in `roles/{uid}` with `admin: true`). Blocked on: the owner doing this in Firebase.
- Move scoring to trusted backend (Cloud Functions). Blocked on: Firebase billing + deploy access.
- Voice chat in rooms/Rush (needs a paid voice service). 1v1 voice done.
- Tournaments, battle pass/missions, clans, store/wallet, access codes/payments, support tickets, sponsors, spectator/replay, installable app.
