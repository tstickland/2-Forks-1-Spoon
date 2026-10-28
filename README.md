# 2 Forks 1 Spoon

A free, installable web app for batch meal prep: plan grams per person per meal, see when each batch runs out, and generate shared Costco and grocery lists. See `CLAUDE.md` for the design.

## Run locally (no Firebase account needed)

```sh
npm install
npm run emulators          # terminal 1: local Auth + Firestore (needs Java)
```

```sh
# terminal 2 — PowerShell: $env:VITE_USE_EMULATORS="true"; npm run dev
VITE_USE_EMULATORS=true npm run dev
```

Open http://localhost:5173 and sign in with a fake account from the emulator's popup. Emulator data is discarded when it stops. The emulator UI is at http://localhost:4000.

## Tests

```sh
npm test             # domain unit tests
npm run test:rules   # Firestore security rules, against the emulator
```

## Set up the real (free) Firebase project

1. Go to https://console.firebase.google.com, choose **Add project**, and stay on the free **Spark** plan.
2. **Build → Firestore Database → Create database**, in production mode, in a region near you.
3. **Build → Authentication → Get started → Google**, then enable it.
4. **Project settings → Your apps → Web (`</>`)**: register an app and copy the config values into `.env.local`, using `.env.example` as the template.
   - Set `VITE_FIREBASE_AUTH_DOMAIN` to `<project-id>.web.app` (the Hosting domain), **not** `firebaseapp.com`. This keeps Google sign-in working inside the installed iPhone app.
   - Then go to **Authentication → Settings → Authorized domains** and make sure `<project-id>.web.app` is listed.
5. Put your project ID in `.firebaserc` in place of `demo-2-forks-1-spoon`.
6. `npx firebase login`, then `npm run deploy` (builds, then deploys hosting, rules and indexes).

## Install on your phones

Open `https://<project-id>.web.app`:

- **iPhone:** in Safari, tap Share, then **Add to Home Screen**.
- **Android:** in Chrome, open the menu and choose **Install app**.

One person signs in and taps **Create household**. In **Settings → Invite your partner**, enter the partner's Google email. The partner then signs in on their phone and taps **Join**.
