#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') as string ?? 'staging';
const region = app.node.tryGetContext('region') as string ?? 'eu-west-1';

const env: cdk.Environment = {
  region,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

const networkStack = new NetworkStack(app, `Marketplace-${environment}-Network`, {
  env,
  description: `Marketplace ${environment} — VPC, subnets, and security groups`,
  environment,
});

new AppStack(app, `Marketplace-${environment}-App`, {
  env,
  description: `Marketplace ${environment} — RDS, ECS Fargate, ALB, S3, Secrets Manager`,
  environment,
  vpc: networkStack.vpc,
  albSecurityGroup: networkStack.albSecurityGroup,
  ecsSecurityGroup: networkStack.ecsSecurityGroup,
  rdsSecurityGroup: networkStack.rdsSecurityGroup,
});

app.synth();
