---
id: "021"
title: "Provision AWS EC2 + RDS PostgreSQL infrastructure"
status: "todo"
area: "infra"
agent: "@systems-architect"
priority: "high"
created_at: "2026-04-10"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: ["022"]
blocked_by: []
---

## Description

Provision the AWS infrastructure for the EC2 + RDS PostgreSQL architecture (replaces the previous ECS Fargate approach from task #020). The goal is a simple, low-cost staging setup that can be stood up manually via AWS Console or a minimal shell script — no CDK required.

Architecture:
```
Internet
    ↓ port 80/443
EC2 t3.micro (public subnet)
  — Node.js backend process managed by PM2
  — Nginx reverse proxy (port 80 → 3000)
    ↓ port 5432
RDS PostgreSQL db.t3.micro (private subnet, no internet access)
```

## Acceptance Criteria

- [ ] VPC created with at least one public subnet (EC2) and one private subnet (RDS)
- [ ] Security groups configured:
  - EC2 SG: inbound 22 (SSH, your IP only), 80 (HTTP), 443 (HTTPS)
  - RDS SG: inbound 5432 from EC2 SG only
- [ ] RDS PostgreSQL 15 instance running in private subnet, automated backups enabled (7-day retention)
- [ ] EC2 t3.micro running Amazon Linux 2023, Node.js LTS installed, PM2 installed globally
- [ ] Nginx installed on EC2, configured as reverse proxy to port 3000
- [ ] EC2 can connect to RDS (test with `psql` from EC2)
- [ ] All secrets (DB password, Auth0 values) stored in AWS Secrets Manager — not in any file on EC2
- [ ] EC2 instance has an IAM role with permissions to read Secrets Manager + read/write S3
- [ ] S3 bucket created for listing images (block all public access, CORS configured)
- [ ] Infrastructure setup steps documented in `docs/technical/BACKEND_DEPLOY.md`

## Technical Notes

- **EC2 key pair**: Create a key pair in the AWS console before provisioning. Save the `.pem` file securely.
- **Elastic IP**: Assign an Elastic IP to the EC2 instance so the address doesn't change on reboot.
- **RDS credentials**: Use AWS Secrets Manager. The backend reads them at startup via the AWS SDK and constructs `DATABASE_URL`. See `apps/backend/src/index.ts` — the `DB_HOST / DB_USERNAME / DB_PASSWORD / DB_NAME` env var construction is already implemented.
- **IAM role for EC2**: Attach an instance profile with:
  - `secretsmanager:GetSecretValue` on `marketplace/staging/*`
  - `s3:PutObject`, `s3:GetObject` on the images bucket
- **Region**: eu-west-1 (Ireland) per project default.
- **Cost estimate**: EC2 t3.micro ~$8/mo + RDS db.t3.micro ~$15/mo + S3 <$1/mo ≈ **~$24/month**

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-10 | human | Task created — switching from ECS Fargate to EC2 approach |
