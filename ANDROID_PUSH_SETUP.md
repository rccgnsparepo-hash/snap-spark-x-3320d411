# Flick — Android build + native push (OneSignal + FCM)

The `android/` folder is committed, so aistudioapk.com (or Android Studio) can build it directly.

## OneSignal App ID linked to this project
`a03fc9f3-4a7e-498f-89fe-2436e4de34d0`  (see `src/config/onesignal.ts`)
App ID (Android package): `app.lovable.p600ed84d2abb4a80b188e89fabece62d`

## Build steps
1. `npm install`
2. `npm run build`  (outputs `dist/`)
3. `npx cap sync android`
4. Build the APK (aistudioapk.com, or `cd android && ./gradlew assembleDebug`)

> `capacitor.config.ts` currently points `server.url` at the Lovable preview for hot reload.
> Remove the whole `server` block before shipping a store/offline build.

## Finalising native push
1. **Firebase (FCM v1)**
   - Create a Firebase project → Add Android app with package `app.lovable.p600ed84d2abb4a80b188e89fabece62d`.
   - Download `google-services.json` → place it at `android/app/google-services.json`.
   - Project settings → Service accounts → Generate new private key (JSON).
2. **OneSignal**
   - Dashboard → Settings → Push & In-App → Google Android (FCM) → upload that service-account JSON.
   - Confirm the App ID matches `a03fc9f3-4a7e-498f-89fe-2436e4de34d0`.
3. **Backend secrets** (already wired in the `notify` edge function): `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`.
4. Install the APK, allow the notification prompt, sign in — the app calls
   `OneSignal.login(<supabase user id>)`, so the server targets `external_id` and the same
   payload reaches web + Android.
5. Test: OneSignal → Messages → New Push → target by External User ID.

Deep links: notifications carrying `flick://...` open the app via the manifest intent-filter
and are routed by `src/lib/native/appLifecycle.ts`.
