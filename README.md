# RUSH Multiplayer Web — free-to-start package

A browser-based multiplayer parkour race. Players in the same room see each other's runners in real time.

## What is included
- Browser game (no APK required)
- Room codes and runner names
- Live player positions using WebSockets
- Parkour jumps, platforms, spikes, moving hazards, finish line
- Keyboard and mobile touch controls
- Node.js server

## Run it on your computer
1. Install Node.js 18 or newer.
2. Extract this ZIP.
3. Open a terminal inside the extracted `RUSH_Multiplayer_Web` folder.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:3000` in your browser.

To test multiplayer locally, open the page in two browser tabs and enter the same room code.

## Put it online for free
This project needs a host that supports a Node.js process and WebSockets; a static-only host is not enough.
1. Upload this folder to a GitHub repository.
2. Create a new **Web Service** on a host with a free Node.js tier that supports WebSockets (for example, Render).
3. Set the build/install command to `npm install` and start command to `npm start`.
4. Deploy, then share the generated HTTPS URL with friends. The server automatically uses the host's `PORT`.

Free tiers and policies can change, may sleep when idle, and may have usage limits. Check the host's current terms before deploying. No hosting account has been created and no public URL is included in this ZIP.

## Important prototype notes
This is the first playable web prototype, not a port of the Unity project assets. It uses a 2D side-view parkour course inspired by the RUSH obstacle-race idea. It is not yet a competitive production game: movement is client-simulated and the server relays positions, so anti-cheat, persistent accounts, voice chat, matchmaking, and robust race synchronization are not included.
