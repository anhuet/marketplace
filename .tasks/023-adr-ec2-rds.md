---
id: "023"
title: "Record ADR-005: EC2 + RDS over ECS Fargate for backend compute"
status: "todo"
area: "docs"
agent: "@documentation-writer"
priority: "normal"
created_at: "2026-04-10"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: []
blocked_by: ["021"]
---

## Description

Record the architecture decision to switch from ECS Fargate (ADR-003) to EC2 + RDS PostgreSQL as the backend compute platform. The new ADR should supersede ADR-003 and document the rationale, trade-offs, and consequences.

## Acceptance Criteria

- [ ] ADR-005 appended to `docs/technical/DECISIONS.md`
- [ ] ADR-005 explicitly references ADR-003 as superseded
- [ ] `docs/technical/ARCHITECTURE.md` updated to reflect EC2 deployment diagram (replace ECS/ALB diagram)
- [ ] Cost comparison documented (ECS ~$75/mo → EC2 ~$24/mo)

## Technical Notes

Key points to capture in the ADR:
- **Why EC2**: lower cost (~$24/mo vs ~$75/mo), simpler setup (no VPC NAT Gateway, no ALB, no CDK), SSH access for debugging, sufficient for current scale
- **Why keep RDS**: PostgreSQL is required for Haversine geo queries and relational data model (conversations, reviews, invite codes). DynamoDB was considered and rejected.
- **Trade-offs accepted**: Manual scaling (vs Fargate auto-scale), manual OS patching, no zero-downtime deploy without extra setup
- **Upgrade path**: If traffic grows significantly, can migrate to ECS Fargate by containerizing the same app — the Dockerfile already exists

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-10 | human | Task created |
