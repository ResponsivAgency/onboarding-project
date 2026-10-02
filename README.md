# Team Maria onboarding

Clickable prototype of a distributor onboarding app for network marketing
teams: a login screen, the distributor's video training path, and the
leader's admin dashboard.

This is a prototype. Logins are not real, and everything entered is kept
only in the visitor's own browser, so don't enter real people's details.

## Run it locally

Requires Node.js 18 or newer. No dependencies to install.

```
npm start
```

Then open http://localhost:3000.

## Deploy on Railway

1. In Railway, create a new project and choose **Deploy from GitHub repo**.
2. Pick this repository. Railway detects `package.json` and runs `npm start`.
3. In the service's **Settings → Networking**, click **Generate Domain**.

Every push to the deployed branch redeploys automatically.
