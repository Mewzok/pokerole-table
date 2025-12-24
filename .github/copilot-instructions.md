# Copilot instructions — pokerole-table

Short context
- Small Node.js + Socket.IO app that serves a static UI from `server.js`.
- Server listens on port 3000; static files are served from the `public/` folder.

Architecture & data flow (what to know)
- `server.js` is the single backend process: it keeps an in-memory `players` Map keyed by `socket.id` and a `lastSeen` Map for heartbeat cleanup.
- Socket.IO events to be aware of (server ↔ client):
  - `request-join` → server responds with `join-approved` or `join-denied`.
  - `player-list` — broadcast current player list.
  - `heartbeat` — client pings to remain in `lastSeen`.
  - `sharedRoll` → server broadcasts `sharedRollResult`.
  - `change-name` → `name-change-approved` / `name-change-denied`.
  - `playerJoinedAnnouncement` and `event-log` for UX notifications.
- Client behavior: `public/client.js` persists `playerId` and `playerName` in `localStorage` and attempts to rejoin using `existingId`.

Why this matters
- Design choice: in-memory state (no DB) and simple broadcast model. Keep changes lightweight and avoid introducing persistent state without explicit reason.
- Heartbeat interval and the ghost cleanup timer are central to connection/UX behavior — changing them will affect how quickly stale players are removed.

Developer workflows & commands
- Run locally: `node server.js` (server prints "Server is running at http://localhost:3000").
- Open browser to http://localhost:3000; use browser console to inspect `Socket.IO` events.
- When adding new dependencies: update `package.json` (`type` is `commonjs`) and run `npm install`.

Patterns & conventions to follow
- Use CommonJS `require()` style to match `package.json` `type: "commonjs"`.
- Server-side state is stored in Maps keyed by `socket.id`; when updating a player, keep the same `id` semantics used in `request-join` (preserve an existing player's `id` if `existingId` is provided).
- Emit events consistently with existing names and payload shapes. Example: a server broadcast for a shared roll uses
  ```js
  io.emit("sharedRollResult", { name, roll });
  ```
- Keep the `public/` UI small and DOM-driven (no framework). New UI code should follow the existing vanilla JS patterns in `public/client.js` (DOM queries, `addEventListener`, manual `innerHTML` updates).

Key files to inspect when changing behavior
- [server.js](server.js) — main server logic, event handlers, and cleanup logic.
- [public/client.js](public/client.js) — client-side event handling, localStorage usage, and UI flows.
- [package.json](package.json) — dependency list; note there is no `start` script.

If you modify behavior
- Update both server and client event names/payloads together. Search for event names in `server.js` and `public/client.js` before renaming.
- Add/update `package.json` scripts when introducing build/test tasks.

Where to ask for help
- If unsure about a change that affects player state lifecycle (join/heartbeat/disconnect), ask the maintainer before adding persistent storage or changing timers.

Feedback
- If any behavior is unclear or you need examples (e.g., adding a new event), ask and include the exact files you want to change.
