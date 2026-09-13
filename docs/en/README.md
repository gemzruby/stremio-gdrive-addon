# DriveMio — English guide

## 1. Introduction

DriveMio lets you watch **private** Google Drive videos in Nuvio TV or another Stremio-compatible app. A Cloudflare Worker reads the videos from Drive and streams them to your TV. Your files do not need to be public. The addon does not transcode video, so start with an H.264/AAC MP4.

The flow is simple: upload videos to one Drive folder → run `make generate-media` to build the catalog → run `make deploy` → install the URL printed by `make manifest-url` in Nuvio. Repeat the generate-and-deploy steps when the folder changes. You do not need one folder per video. Posters are optional; use public HTTPS image URLs if you want artwork on the TV.

You need Git, `make`, Node.js 22.13+ or 24+, a Google account, and a Cloudflare account. The addon is designed for one owner, without separate viewer accounts.

## 2. Values in `.dev.vars.example`

Create your private local file with `cp .dev.vars.example .dev.vars`, then fill in:

| Variable | What to enter | Where to get it |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Your OAuth app's client ID | Google Cloud → Google Auth platform → Clients |
| `GOOGLE_CLIENT_SECRET` | The same OAuth app's client secret | The same page |
| `GOOGLE_REFRESH_TOKEN` | A **refresh token**, not an access token | OAuth 2.0 Playground, after “Exchange authorization code for tokens” |
| `ADDON_TOKEN` | Random string protecting the addon URL | Run `openssl rand -hex 32` |
| `STREAM_SIGNING_SECRET` | A **different** random string for signing video URLs | Run `openssl rand -hex 32` again |
| `PUBLIC_BASE_URL` | Keep `http://localhost:8787` for local development | Already set in the example |
| `STREAM_URL_TTL_SECONDS` | Signed video URL lifetime in seconds; `3600` by default | Usually leave unchanged |
| `DRIVE_FOLDER_ID` | ID of the folder containing your videos | The part after `/folders/` in the Drive folder URL |

You must also edit two fields in `wrangler.jsonc`: `name` is your Worker name, and `vars.PUBLIC_BASE_URL` is the Worker's HTTPS address, for example `https://my-videos.my-subdomain.workers.dev`. This is **different** from the local `PUBLIC_BASE_URL` in `.dev.vars`. The secret names in `wrangler.jsonc` are not secret values.

Git ignores your real `.dev.vars`, `wrangler.jsonc`, and `src/data/media.json`. Commit only the `*.example` files. Keep the URL printed by `make manifest-url` private because it contains `ADDON_TOKEN`.

## 3. Get the values and deploy

First, download the code and create your private local configuration files:

```bash
git clone https://github.com/gemzruby/stremio-gdrive-addon.git
cd stremio-gdrive-addon
make install
cp .dev.vars.example .dev.vars
cp wrangler.example.jsonc wrangler.jsonc
```

### Step 1 — Create a Drive folder and upload a video

1. In [Google Drive](https://drive.google.com/), create a folder such as `stremio-videos`. Keep access set to **Restricted**; do not enable “Anyone with the link”.
2. Upload a test video such as `demo-1.mp4` directly into the folder. The Google account used for OAuth must be able to download this file.
3. Open the folder. Copy the ID from a URL like `https://drive.google.com/drive/folders/<FOLDER_ID>` into `DRIVE_FOLDER_ID` in `.dev.vars`.

### Step 2 — Create a Google Cloud project and enable the Drive API

1. Open [Google Cloud Console](https://console.cloud.google.com/), sign in with the Google account that can access the video, and choose **New project** from the project picker.
2. Name and create the project. Make sure it is selected.
3. Go to **APIs & Services → Library**, search for **Google Drive API**, open it, and click **Enable**. [Official API setup guide](https://developers.google.com/workspace/guides/enable-apis).

### Step 3 — Create an OAuth client

1. In Google Cloud Console, open **Google Auth platform → Branding**. If you see **Get started**, enter an app name, support email, and contact email.
2. In **Audience**, choose **External** for a personal Google account. If the app is in **Testing**, add your own Google email under **Test users**. In **Data Access**, add `https://www.googleapis.com/auth/drive.readonly` if the UI asks you to declare scopes. [OAuth consent guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
3. Open **Google Auth platform → Clients → Create client**. Choose **Web application**.
4. Under **Authorized redirect URIs**, add exactly `https://developers.google.com/oauthplayground`, then create the client.
5. Copy **Client ID** and **Client secret** into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.dev.vars`.

### Step 4 — Get a refresh token

1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/). Click the gear icon. Enable **Use your own OAuth credentials** and enter the client ID and secret you just created. Set **Access type: Offline**.
2. In **Step 1**, enter `https://www.googleapis.com/auth/drive.readonly` and click **Authorize APIs**. Select the Google account that owns the videos and grant access.
3. In **Step 2**, click **Exchange authorization code for tokens**. Copy the **Refresh token** into `GOOGLE_REFRESH_TOKEN`. Do **not** copy the short-lived Access token.
4. Note: [Playground may revoke tokens after 24 hours if you do not use your own OAuth credentials](https://developers.google.com/oauthplayground/). Google also [limits refresh tokens for External apps in Testing to seven days](https://developers.google.com/identity/protocols/oauth2#expiration). For longer use, consider moving the OAuth app to **In production**; Google may require verification depending on your scopes and use.

### Step 5 — Set up the project and check Drive

Enter the Google values you collected in `.dev.vars`. Run `openssl rand -hex 32` **twice** to create distinct `ADDON_TOKEN` and `STREAM_SIGNING_SECRET` values. Then run:

```bash
make preview-media
make generate-media
```

`make preview-media` should find at least one video. If Google OAuth fails, check the refresh token and OAuth client. `make generate-media` writes `src/data/media.json`. You can add `poster` and `background` manually with public HTTPS image URLs; private Drive thumbnails are not suitable as public posters.

### Step 6 — Create a Cloudflare account and deploy

1. Sign up or sign in at the [Cloudflare Dashboard](https://dash.cloudflare.com/). **Workers Free** is enough to start; [Free plan limits](https://developers.cloudflare.com/workers/platform/pricing/) still apply.
2. Under **Workers & Pages**, find or set your account's `workers.dev` subdomain. [Cloudflare's URL format guide](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).
3. In `wrangler.jsonc`, change `name` to your Worker name, such as `my-videos`. Set `vars.PUBLIC_BASE_URL` to `https://my-videos.<your-subdomain>.workers.dev`. Do not put Google tokens in this file.
4. Run:

```bash
make login
make deploy
make manifest-url
```

`make login` opens your browser to authorize Wrangler. `make deploy` checks the code, then uploads it and the five secrets from `.dev.vars` to Cloudflare. `make manifest-url` prints the private URL for Nuvio.

### Step 7 — Install in Nuvio TV

In Nuvio, open **Add-ons**, choose the manual URL install option, and enter the **complete** URL printed by `make manifest-url`, including `/manifest.json`. Open the **My Drive** catalog, choose a video, and select the **Google Drive** stream. Test playback and seeking. If the catalog loads but playback hangs, run `make preview-media` to check the refresh token. If a new token works locally, run `make deploy` and request a fresh stream URL.

## 4. `make` commands

| Command | When to use it |
| --- | --- |
| `make help` | List all commands. |
| `make install` | After cloning; install dependencies and create sample media if needed. |
| `make preview-media` | Count Drive videos without changing any files. |
| `make generate-media` | Rebuild the local catalog from your Drive folder. |
| `make check` | Run typecheck, lint, and tests. |
| `make test` | Run tests only. |
| `make dev` | Run the Worker locally at `http://localhost:8787`. |
| `make login` | Authorize Wrangler for your Cloudflare account. |
| `make deploy` | Run `make check`, then deploy code and secrets to Cloudflare. |
| `make manifest-url` | Print the production manifest URL for Nuvio; keep it private. |

After adding or removing videos, run `make generate-media && make deploy`. For videos inside subfolders, use `make generate-media RECURSIVE=1`. To use a different folder for one run, use `make generate-media FOLDER_ID=<FOLDER_ID>`.
