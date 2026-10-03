# Publish MAYDAY on Render

The app is prepared for a single Render web service. Render supplies HTTPS and WebSocket upgrades at the same public origin. No custom domain or database is required.

## Account steps

1. Create a GitHub repository named `mayday-tower-control`, or use another supported Git provider. A private repository is fine if you connect it to Render.
2. Upload this project's source files at the repository root, including the `server`, `src`, `public`, and `tests` folders, Dockerfile, render.yaml, and dependency lockfile. Do not upload node_modules, dist, build, or local environment secrets.
3. Sign in to https://dashboard.render.com/ and connect the repository.
4. Choose **New → Web Service**, select the repository, choose the **Docker** runtime, and select the **Free** instance type.
5. Use `/health` as the health-check path. Set `NODE_ENV=production`, `HOST=0.0.0.0`, and `PORT=10000` if configuring manually. The Dockerfile already supplies defaults. Leave the root directory blank when the source is at the repository root.
6. Deploy and wait for the service to report live. Copy the actual HTTPS URL Render gives you; do not guess the URL from the service name.
7. Open that URL on two devices, create/join a room, start a round, issue a command, and check reconnection. Use the verified URL in Handshake.

Alternatively, **New → Blueprint** can import `render.yaml` from the repository and configure the service.

## Limits

Free services can sleep after inactivity, and the first visit can be slow while they wake. Data is in memory: server restarts/deployments end active rooms. Keep exactly one instance; replicas would have separate room states. Use a paid instance only if you decide you need uninterrupted availability. No paid plan has been authorized or selected in this package.

## Local production check

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec tsc -p tsconfig.server.json
NODE_ENV=production node build/server/index.js
```

The Docker image has not been built locally unless Docker is available. The compiled production server is checked separately.
