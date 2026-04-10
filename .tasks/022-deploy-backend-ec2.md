---
id: "022"
title: "Deploy backend application to EC2 and run Prisma migrations"
status: "todo"
area: "backend"
agent: "@backend-developer"
priority: "high"
created_at: "2026-04-10"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: []
blocked_by: ["021"]
---

## Description

Deploy the Node.js/Express backend to the EC2 instance provisioned in task #021. This includes:
- Cloning the repo on EC2
- Building the backend (TypeScript compile + Prisma generate)
- Running Prisma migrations against the RDS instance
- Starting the process with PM2
- Verifying the health endpoint is reachable via the public EC2 IP

## Acceptance Criteria

- [ ] Repo cloned on EC2 at `/home/ec2-user/marketplace`
- [ ] `yarn install` and `yarn workspace backend build` run successfully on EC2
- [ ] Environment variables set on EC2 via a `/etc/environment` or `/home/ec2-user/marketplace/apps/backend/.env` file — sourced from Secrets Manager, not hardcoded
- [ ] Prisma migrations applied: `npx prisma migrate deploy` completes with no errors
- [ ] Backend started with PM2: `pm2 start apps/backend/dist/index.js --name marketplace-backend`
- [ ] PM2 configured to restart on reboot: `pm2 startup` + `pm2 save`
- [ ] Health check passes: `curl http://<ec2-public-ip>/api/v1/health` returns `{"status":"ok","db":"connected",...}`
- [ ] Nginx correctly proxies port 80 → 3000
- [ ] `EXPO_PUBLIC_API_URL` in mobile app updated to `http://<ec2-elastic-ip>/api/v1`
- [ ] Deployment steps documented in `docs/technical/BACKEND_DEPLOY.md` (Part 2)

## Technical Notes

### Startup env var construction
`apps/backend/src/index.ts` already has logic to construct `DATABASE_URL` from individual `DB_*` env vars. Set these on EC2:

```bash
export DB_HOST=<rds-endpoint>
export DB_USERNAME=marketplace_admin
export DB_PASSWORD=<from-secrets-manager>
export DB_NAME=marketplace
export DB_PORT=5432
export AUTH0_DOMAIN=dev-htobs7e6.us.auth0.com
export AUTH0_AUDIENCE=marketplace-app
export AWS_REGION=eu-west-1
export S3_BUCKET_NAME=<bucket-name>
export NODE_ENV=production
export PORT=3000
export ALLOWED_ORIGINS=*
```

### PM2 ecosystem file (optional but recommended)
Create `apps/backend/ecosystem.config.js` on the server for PM2:
```js
module.exports = {
  apps: [{
    name: 'marketplace-backend',
    script: 'dist/index.js',
    cwd: '/home/ec2-user/marketplace/apps/backend',
    env: { NODE_ENV: 'production', PORT: 3000 }
  }]
}
```

### Nginx config
`/etc/nginx/conf.d/marketplace.conf`:
```nginx
server {
    listen 80;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

WebSocket (Socket.io) requires the `Upgrade` headers above.

### Re-deploy process (future updates)
```bash
cd /home/ec2-user/marketplace
git pull
yarn workspace backend build
pm2 restart marketplace-backend
```

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-10 | human | Task created |
