<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Paid cosmetics use a dedicated Firestore wallet, separate from game-reward coins; transactions and dedicated Firestore rules protect approvals, spending, ownership and equipment without changing scoring.
- Shop rules are an additive deployment fragment, not a replacement for existing game rules; purchases stay disabled until admins configure packs and install restrictive wallet rules.
- Admin access is decided by the hardcoded `ADMIN_EMAILS` list in `src/lib/app-context.tsx` — the owner asked for no Firebase role setup.
- tsconfig keeps `noUncheckedIndexedAccess`/`noPropertyAccessFromIndexSignature` off — Firestore document data is index-typed everywhere and those checks only add noise.
- Firebase uses its public web configuration directly in the browser; this avoids depending on a server secret for a public client identifier.
- Match voice uses an opt-in WebRTC mesh with session-scoped Firestore presence and pair signaling; isolating each join prevents stale offers and keeps voice independent of match screen transitions.
- Subjects live only in the Firestore `subjects` collection (doc id = lowercased, space-collapsed name) via `src/lib/subjects.ts`; never hardcode subject lists so new subjects need no code change.
- CBT course settings (duration, question count, pass mark) live as cbt* fields on the course's `subjects` doc; attempts go to `cbt_attempts` — keeps one source of truth for courses.
- Ranked RP/tier/placement math stays pure in `src/lib/ranked.ts`; admin-tunable values live at Firestore `settings/ranked` via `ranked-store.ts` — keeps rules unit-testable and changeable without code edits.
- Payment details and battle sponsors live on Firestore `settings/app` (`payment`, `sponsors`), normalized in `src/lib/payment.ts`; signed-out sign-up already reads that doc, and admins edit it without code changes.
- A battle or tournament course selection is one or more courses, stored in the `subject` field as `"all"` or a comma-joined list, and only ever read/written through the pure helpers in `src/lib/course-pick.ts` — old single-course and `"all"` documents keep working, and the selection rules stay unit-testable.
