# YUSUP RAWWRS — Cloudflare Pages + D1

This project is prepared for GitHub + Cloudflare Pages (no Vercel and no rented server). It includes a static dashboard, D1 database schema, backend API functions for email OTP registration/login, signed sessions, rate limiting, and current system status.

## Honest feature status
- Frontend/dashboard: included.
- Real register/login/email OTP: implemented in the backend; it only works after Cloudflare D1 and Resend are configured and the site is deployed.
- Owner role: assigned only when the registering email matches `OWNER_EMAIL` configured as a secret before that account registers. Register the owner mailbox first.
- Pterodactyl creation: not active because you said you do not yet have a panel. It must be connected later using a real panel URL and least-privilege Application API key.
- CPU/RAM and DDoS: not represented as real metrics until a panel/monitoring provider is connected.
- Web2APK/ZIP2APK, GitHub builder, Netlify deployment and AM Premium: UI modules are present but not operational yet; each needs a real authorized service/build runner.

## 1. Create D1 database
1. Sign in to Cloudflare Dashboard.
2. Workers & Pages → D1 SQL Database → Create database; name it `yusup-rawwrs-db`.
3. Open the database console and run `migrations/0001_init.sql`.
4. In `wrangler.toml`, replace `REPLACE_WITH_D1_DATABASE_ID` with the D1 database ID.

## 2. Configure email OTP with Resend
1. Create a Resend account and verify a sending domain/address according to Resend's current rules.
2. Create a Resend API key.
3. In Cloudflare Pages project → Settings → Variables and Secrets, add:
   - `RESEND_API_KEY` (secret)
   - `MAIL_FROM` (e.g. a sender address verified in Resend)
   - `JWT_SECRET` (secret, random long value)
   - `OTP_PEPPER` (secret, different random long value)
   - `OWNER_EMAIL` (the exact email that should become owner)
4. Never put any of these secrets in GitHub files or browser JavaScript.

## 3. Publish through GitHub
1. Create a **private** GitHub repository named `yusup-rawwrs`.
2. Upload all files from this folder to the repository root.
3. In Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
4. Select the repository. Build command: leave empty. Build output directory: `.`.
5. In Pages Settings → Functions, bind the D1 database using variable name `DB` and select `yusup-rawwrs-db`.
6. Add the secrets above, then deploy.
7. Register the exact `OWNER_EMAIL` address first and complete OTP. It will receive the owner role. Other users receive the user role.

## 4. Domain
In Cloudflare Pages → Custom domains, add `yusup-rawwrs.cc.cd` and follow the DNS instructions Cloudflare provides. You must have access to the domain's DNS control panel. DNS changes may take time to propagate.

## API routes
- `POST /api/auth` with `{action:"register", email, password}` sends OTP.
- `POST /api/auth` with `{action:"verify", email, code}` verifies and creates account.
- `POST /api/auth` with `{action:"login", email, password}` logs in.
- `GET /api/me` requires `Authorization: Bearer <token>`.
- `GET /api/system` requires a valid session.

## Important
Do not share API keys, passwords, recovery codes or tokens in chat. Use Cloudflare's dashboard secrets. This package is not deployed yet; it becomes live only after you complete the provider setup above.
