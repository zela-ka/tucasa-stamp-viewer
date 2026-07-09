# Deployment Guide — TUCASA STUM

This app uses a **frontend-only deployment** architecture:

```
React + Vite Frontend (Hostinger VPS)
              |
              v
        Lovable Cloud Backend
              |
   +----------+----------+
   |          |          |
Database     Auth      Storage
PostgreSQL   Users     Files
```

The React app is a static build served by Nginx on a Hostinger VPS.
**All backend services — database, authentication, storage, edge functions, and
RLS policies — stay fully managed by Lovable Cloud.** Nothing runs on the VPS
except the static frontend and Nginx.

> Do NOT run any Node/Laravel/API server on the VPS. The app talks directly to
> Lovable Cloud from the browser using the Supabase JS client.

---

## 1. Prerequisites

- A Hostinger VPS with Ubuntu 22.04+ and root/sudo access
- Node.js 20+ and npm installed locally (to build the app)
- Your Lovable Cloud credentials (URL + publishable/anon key)

---

## 2. Configure environment variables

Copy the example file and fill in your Lovable Cloud values:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_ANON_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
```

Notes:
- These are **public** values, safe to include in the browser bundle. Data is
  protected by Row Level Security.
- **Never** put the service_role key or database password in the frontend.
- Vite inlines `VITE_*` variables at **build time**, so rebuild after changing them.

---

## 3. Build the React app

```bash
npm install
npm run build
```

This produces a static `dist/` folder containing `index.html` and hashed assets.

Preview the production build locally (optional):

```bash
npm run preview
```

---

## 4. Deploy the dist/ folder to Hostinger VPS

From your local machine, upload the build output:

```bash
rsync -avz --delete dist/ root@YOUR_VPS_IP:/var/www/tucasa/
```

Or with scp:

```bash
scp -r dist/* root@YOUR_VPS_IP:/var/www/tucasa/
```

Ensure the directory exists and is readable by Nginx:

```bash
ssh root@YOUR_VPS_IP "mkdir -p /var/www/tucasa && chown -R www-data:www-data /var/www/tucasa"
```

---

## 5. Nginx configuration for a React SPA

Create `/etc/nginx/sites-available/tucasa`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/tucasa;
    index index.html;

    # SPA fallback — all routes serve index.html so React Router works
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache hashed static assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Never cache index.html so new deploys are picked up immediately
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
```

Enable the site and reload:

```bash
ln -s /etc/nginx/sites-available/tucasa /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 6. HTTPS (recommended)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot updates the Nginx config to listen on 443 and auto-renews the cert.

---

## 7. Redeploying updates

1. Rebuild: `npm install && npm run build`
2. Re-upload: `rsync -avz --delete dist/ root@YOUR_VPS_IP:/var/www/tucasa/`
3. No Nginx reload needed unless the server config changed.

---

## 8. Backend (Lovable Cloud) — no action needed on the VPS

These remain hosted and managed by Lovable Cloud and require **no** deployment on Hostinger:

- **Database** (PostgreSQL + migrations + RLS policies)
- **Authentication** (phone/OTP users, sessions)
- **Storage** (image/document uploads, file URLs, access rules)
- **Edge Functions** (send-otp, verify-otp)

The frontend reaches them via the Supabase client configured with the
`VITE_SUPABASE_*` environment variables above.

---

## Environment variables reference

| Variable                        | Required | Description                            |
| ------------------------------- | -------- | -------------------------------------- |
| VITE_SUPABASE_URL               | yes      | Lovable Cloud project URL              |
| VITE_SUPABASE_ANON_KEY          | yes      | Public anon/publishable key            |
| VITE_SUPABASE_PUBLISHABLE_KEY   | yes      | Same value; the client reads this name |
| VITE_SUPABASE_PROJECT_ID        | optional | Project ref used by tooling            |
