# Backend Deployment Guide

> Last updated: 2026-04-10
> Covers: running locally for development, and deploying to AWS with CDK.

---

## Part 1 — Run Backend Locally

### Prerequisites

- **Node.js** LTS (check `.nvmrc` — use `nvm use` if you have nvm)
- **Yarn Classic v1** — `npm install -g yarn`
- **PostgreSQL 15** — run locally via Docker (see below) or use an existing instance

### 1. Start PostgreSQL with Docker

```bash
docker run -d \
  --name marketplace-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=marketplace \
  -p 5432:5432 \
  postgres:15-alpine
```

To stop/start later: `docker stop marketplace-db` / `docker start marketplace-db`

### 2. Configure environment variables

The file `apps/backend/.env` already exists. Verify these values:

```env
PORT=3000
NODE_ENV=development

# Auth0 — must match your Auth0 tenant
AUTH0_DOMAIN=dev-htobs7e6.us.auth0.com
AUTH0_AUDIENCE=marketplace-app

# Database — matches the Docker container above
DATABASE_URL=postgresql://postgres:password@localhost:5432/marketplace

# AWS S3 — leave blank to skip image uploads in local dev
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=

# Expo push notifications — leave blank in local dev
EXPO_ACCESS_TOKEN=

# CORS
ALLOWED_ORIGINS=*
```

### 3. Install dependencies

From the monorepo root:

```bash
yarn install
```

### 4. Run Prisma migrations

```bash
yarn workspace backend exec npx prisma migrate deploy
```

This creates all tables in your local `marketplace` database.

To also seed categories (if a seed script exists):

```bash
yarn workspace backend exec npx prisma db seed
```

### 5. Start the dev server

```bash
yarn workspace backend dev
```

Server starts on `http://localhost:3000`.

### 6. Test the health endpoint

```bash
curl http://localhost:3000/api/v1/health
# Expected: {"status":"ok","db":"connected","timestamp":"..."}
```

### 7. Inspect the database (optional)

```bash
yarn workspace backend exec npx prisma studio
# Opens browser UI at http://localhost:5555
```

---

## Part 2 — Deploy to AWS

### Prerequisites

- **AWS CLI** configured: `aws configure` (region: `eu-west-1`)
- **AWS account ID** — find it with `aws sts get-caller-identity --query Account --output text`
- **Docker** running locally (CDK builds the image during deploy)
- **Node.js + Yarn** installed (same as local dev)
- IAM user/role with these permissions:
  - `iam:*` (CDK needs this to create task roles)
  - `ec2:*`, `ecs:*`, `rds:*`, `s3:*`, `secretsmanager:*`
  - `elasticloadbalancing:*`, `logs:*`, `ecr:*`
  - `cloudformation:*` (CDK deploys via CloudFormation)

### Step 1 — Apply the DATABASE_URL fix

> **Already done.** `apps/backend/src/index.ts` now constructs `DATABASE_URL` from the individual `DB_*` env vars that Secrets Manager injects into the ECS container. No further action needed.

### Step 2 — Bootstrap CDK (first time only)

```bash
cd infra
npm install

# Replace <account-id> with your AWS account ID
npx cdk bootstrap aws://<account-id>/eu-west-1
```

### Step 3 — Deploy infrastructure

```bash
# Still inside infra/
npx cdk deploy --all
```

CDK will:
1. Create the VPC, subnets, and security groups (`Marketplace-staging-Network`)
2. Create RDS PostgreSQL, ECS Fargate service behind ALB, S3 bucket, and Secrets Manager secrets (`Marketplace-staging-App`)
3. Build your Docker image locally and push it to ECR

**Save the outputs printed at the end**, particularly:
- `AlbDnsName` — e.g. `Marketplace-staging-App.AlbDnsName = xyz.eu-west-1.elb.amazonaws.com`
- `AppSecretsArn` — the ARN of the Auth0 secrets

Estimated time: 15–25 minutes (RDS takes the longest).

### Step 4 — Populate Auth0 secrets in Secrets Manager

CDK creates the secret with placeholder values. Replace them now:

```bash
aws secretsmanager put-secret-value \
  --region eu-west-1 \
  --secret-id marketplace/staging/app-secrets \
  --secret-string '{
    "AUTH0_DOMAIN": "dev-htobs7e6.us.auth0.com",
    "AUTH0_AUDIENCE": "marketplace-app"
  }'
```

Then force a new ECS deployment so the container picks up the real values:

```bash
aws ecs update-service \
  --region eu-west-1 \
  --cluster marketplace-staging \
  --service marketplace-staging-BackendService \
  --force-new-deployment
```

### Step 5 — Run Prisma migrations against RDS

The RDS instance is in isolated subnets (no internet access). You have two options:

#### Option A — From your local machine (recommended for first deploy)

1. Temporarily add your IP to the RDS security group:

```bash
MY_IP=$(curl -s https://checkip.amazonaws.com)

# Get the RDS security group ID from the CDK output or console
aws ec2 authorize-security-group-ingress \
  --region eu-west-1 \
  --group-id <rds-security-group-id> \
  --protocol tcp \
  --port 5432 \
  --cidr ${MY_IP}/32
```

2. Get the DB connection string from Secrets Manager:

```bash
aws secretsmanager get-secret-value \
  --region eu-west-1 \
  --secret-id marketplace/staging/db-credentials \
  --query SecretString \
  --output text
# Returns JSON with host, port, username, password, dbname
```

3. Run migrations:

```bash
DATABASE_URL="postgresql://<username>:<password>@<rds-host>:5432/marketplace" \
  yarn workspace backend exec npx prisma migrate deploy
```

4. Remove the temporary security group rule:

```bash
aws ec2 revoke-security-group-ingress \
  --region eu-west-1 \
  --group-id <rds-security-group-id> \
  --protocol tcp \
  --port 5432 \
  --cidr ${MY_IP}/32
```

#### Option B — One-off ECS task (for CI/CD or if you can't open the SG)

```bash
# Get the task definition ARN from the console or:
TASK_DEF=$(aws ecs list-task-definitions --region eu-west-1 \
  --family-prefix Marketplace-staging-App-BackendTask \
  --query "taskDefinitionArns[-1]" --output text)

# Get subnet and security group IDs
SUBNET=$(aws ec2 describe-subnets --region eu-west-1 \
  --filters "Name=tag:Name,Values=*Private*" \
  --query "Subnets[0].SubnetId" --output text)

SG=$(aws ec2 describe-security-groups --region eu-west-1 \
  --filters "Name=description,Values=*ECS Fargate*" \
  --query "SecurityGroups[0].GroupId" --output text)

aws ecs run-task \
  --region eu-west-1 \
  --cluster marketplace-staging \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SG]}" \
  --overrides '{"containerOverrides":[{"name":"marketplace-backend","command":["npx","prisma","migrate","deploy"]}]}'
```

### Step 6 — Verify the deployment

```bash
# Check ECS service is stable
aws ecs describe-services \
  --region eu-west-1 \
  --cluster marketplace-staging \
  --services marketplace-staging-BackendService \
  --query "services[0].{status:status,running:runningCount,desired:desiredCount}"

# Hit the health endpoint via the ALB
curl http://<alb-dns-name>/api/v1/health
# Expected: {"status":"ok","db":"connected","timestamp":"..."}
```

### Step 7 — Update the mobile app

Set the backend URL in the mobile app's environment:

In `apps/mobile/.env` (create if it doesn't exist):

```env
EXPO_PUBLIC_API_URL=http://<alb-dns-name>/api/v1
```

> For production, replace with an HTTPS URL once you add an ACM certificate and configure the ALB listener on port 443.

---

## Monitoring & Logs

```bash
# Tail ECS container logs
aws logs tail /marketplace/staging/backend \
  --region eu-west-1 \
  --follow
```

Or open **CloudWatch Logs** in the AWS console → Log groups → `/marketplace/staging/backend`.

---

## Teardown (staging)

```bash
cd infra
npx cdk destroy --all
```

> RDS and S3 in staging use `RemovalPolicy.DESTROY` so all data is deleted. Do not run this in production.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| ECS task keeps restarting | Missing or wrong secrets | Check CloudWatch logs; verify Auth0 secrets are populated |
| Health check returns 503 | DB connection failed | Confirm `DATABASE_URL` is constructed (check logs for Prisma errors) |
| `cdk deploy` fails on image build | Docker not running | Start Docker Desktop |
| Prisma migration errors | Migrations not run | Run Step 5 again |
| CORS errors from mobile | `ALLOWED_ORIGINS` not set | Add ALB domain or `*` to the env var |
