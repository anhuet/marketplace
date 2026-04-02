import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {
  environment: string;
}

/**
 * NetworkStack provisions the VPC, subnets, and security groups
 * shared by all application resources.
 *
 * Topology:
 *   - 2 public subnets  (ALB)
 *   - 2 private subnets with egress (ECS Fargate tasks — needs NAT for ECR pulls)
 *   - 2 isolated subnets (RDS — no internet access)
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly albSecurityGroup: ec2.ISecurityGroup;
  public readonly ecsSecurityGroup: ec2.ISecurityGroup;
  public readonly rdsSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const vpcCidr = this.node.tryGetContext('vpcCidr') as string ?? '10.0.0.0/16';

    // --- VPC ---
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(vpcCidr),
      maxAzs: 2,
      natGateways: 1, // Single NAT for staging cost savings
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
    this.vpc = vpc;

    // --- Security Groups ---

    // ALB: accepts HTTPS from the internet
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      description: 'ALB — accepts HTTPS (443) from the internet',
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS from internet');
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP from internet (redirect to HTTPS)');
    this.albSecurityGroup = albSg;

    // ECS: accepts traffic only from the ALB
    const ecsSg = new ec2.SecurityGroup(this, 'EcsSg', {
      vpc,
      description: 'ECS Fargate tasks — accepts traffic from ALB only',
      allowAllOutbound: true,
    });
    const containerPort = (this.node.tryGetContext('containerPort') as number) ?? 3000;
    ecsSg.addIngressRule(albSg, ec2.Port.tcp(containerPort), 'Traffic from ALB');
    this.ecsSecurityGroup = ecsSg;

    // RDS: accepts connections only from ECS tasks
    const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc,
      description: 'RDS PostgreSQL — accepts connections from ECS tasks only',
      allowAllOutbound: false,
    });
    const dbPort = (this.node.tryGetContext('dbPort') as number) ?? 5432;
    rdsSg.addIngressRule(ecsSg, ec2.Port.tcp(dbPort), 'PostgreSQL from ECS');
    this.rdsSecurityGroup = rdsSg;

    // --- Outputs ---
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
  }
}
