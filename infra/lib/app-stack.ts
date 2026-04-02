import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface AppStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.ISecurityGroup;
  ecsSecurityGroup: ec2.ISecurityGroup;
  rdsSecurityGroup: ec2.ISecurityGroup;
}

/**
 * AppStack provisions:
 *   - RDS PostgreSQL (isolated subnets)
 *   - ECS Fargate service behind an ALB (private subnets)
 *   - S3 bucket for listing images (presigned URL access)
 *   - Secrets Manager for application secrets
 */
export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const {
      vpc,
      albSecurityGroup,
      ecsSecurityGroup,
      rdsSecurityGroup,
      environment,
    } = props;

    const dbName = (this.node.tryGetContext('dbName') as string) ?? 'marketplace';
    const dbPort = (this.node.tryGetContext('dbPort') as number) ?? 5432;
    const containerPort = (this.node.tryGetContext('containerPort') as number) ?? 3000;
    const desiredCount = (this.node.tryGetContext('ecsDesiredCount') as number) ?? 1;
    const cpu = (this.node.tryGetContext('ecsCpu') as number) ?? 256;
    const memory = (this.node.tryGetContext('ecsMemory') as number) ?? 512;
    const s3Prefix = (this.node.tryGetContext('s3BucketPrefix') as string) ?? 'marketplace-images';

    // -----------------------------------------------------------------------
    // Secrets Manager — application secrets (Auth0, etc.)
    // -----------------------------------------------------------------------
    // The secret must be pre-populated in the console / CLI before first deploy.
    // Expected JSON keys: AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_CLIENT_SECRET
    const appSecrets = new secretsmanager.Secret(this, 'AppSecrets', {
      secretName: `marketplace/${environment}/app-secrets`,
      description: 'Marketplace application secrets (Auth0, etc.)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          AUTH0_DOMAIN: 'REPLACE_ME',
          AUTH0_AUDIENCE: 'REPLACE_ME',
        }),
        generateStringKey: 'GENERATED_KEY', // placeholder — replaced manually
      },
    });

    // -----------------------------------------------------------------------
    // RDS PostgreSQL
    // -----------------------------------------------------------------------
    const dbCredentials = rds.Credentials.fromGeneratedSecret('marketplace_admin', {
      secretName: `marketplace/${environment}/db-credentials`,
    });

    const dbInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSecurityGroup as ec2.SecurityGroup],
      credentials: dbCredentials,
      databaseName: dbName,
      port: dbPort,
      multiAz: false, // staging — single AZ
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: environment === 'production',
      removalPolicy: environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      publiclyAccessible: false,
      monitoringInterval: cdk.Duration.seconds(60),
    });

    // -----------------------------------------------------------------------
    // S3 Bucket — listing images (presigned URL access)
    // -----------------------------------------------------------------------
    const imageBucket = new s3.Bucket(this, 'ImageBucket', {
      bucketName: `${s3Prefix}-${environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'production',
      cors: [
        {
          allowedOrigins: ['*'], // Mobile app uses presigned URLs; origin varies
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
          ],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          // Clean up incomplete multipart uploads
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    });

    // -----------------------------------------------------------------------
    // ECS Cluster + Fargate Service behind ALB
    // -----------------------------------------------------------------------
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: `marketplace-${environment}`,
      containerInsights: true,
    });

    const logGroup = new logs.LogGroup(this, 'BackendLogs', {
      logGroupName: `/marketplace/${environment}/backend`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Task definition
    const taskDef = new ecs.FargateTaskDefinition(this, 'BackendTask', {
      cpu,
      memoryLimitMiB: memory,
    });

    // Grant the task role access to S3 (presigned URL generation)
    imageBucket.grantReadWrite(taskDef.taskRole);

    // Grant the task role access to Secrets Manager
    appSecrets.grantRead(taskDef.taskRole);
    if (dbInstance.secret) {
      dbInstance.secret.grantRead(taskDef.taskRole);
    }

    // Container — image will be built and pushed by CI/CD; use placeholder for now
    const container = taskDef.addContainer('backend', {
      // Build context = monorepo root; Dockerfile lives in apps/backend/
      // In CI/CD, override with a pre-built ECR image URI instead of fromAsset.
      image: ecs.ContainerImage.fromAsset('../..', {
        file: 'apps/backend/Dockerfile',
      }),
      containerName: 'marketplace-backend',
      portMappings: [{ containerPort, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'backend',
        logGroup,
      }),
      environment: {
        NODE_ENV: environment === 'production' ? 'production' : 'staging',
        PORT: containerPort.toString(),
        S3_BUCKET_NAME: imageBucket.bucketName,
        S3_REGION: this.region,
        DB_PORT: dbPort.toString(),
      },
      secrets: {
        // Inject DB credentials from Secrets Manager
        DB_HOST: ecs.Secret.fromSecretsManager(dbInstance.secret!, 'host'),
        DB_USERNAME: ecs.Secret.fromSecretsManager(dbInstance.secret!, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbInstance.secret!, 'password'),
        DB_NAME: ecs.Secret.fromSecretsManager(dbInstance.secret!, 'dbname'),
        // Inject application secrets
        AUTH0_DOMAIN: ecs.Secret.fromSecretsManager(appSecrets, 'AUTH0_DOMAIN'),
        AUTH0_AUDIENCE: ecs.Secret.fromSecretsManager(appSecrets, 'AUTH0_AUDIENCE'),
      },
      healthCheck: {
        command: ['CMD-SHELL', `curl -f http://localhost:${containerPort}/api/v1/health || exit 1`],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ALB Fargate Service
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'BackendService',
      {
        cluster,
        taskDefinition: taskDef,
        desiredCount,
        assignPublicIp: false,
        taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        publicLoadBalancer: true,
        listenerPort: 80, // HTTPS requires a certificate ARN — add via context for production
      },
    );

    // Override the auto-created security groups with our explicit ones
    fargateService.loadBalancer.addSecurityGroup(albSecurityGroup as ec2.SecurityGroup);
    fargateService.service.connections.addSecurityGroup(ecsSecurityGroup as ec2.SecurityGroup);

    // ALB health check tuning
    fargateService.targetGroup.configureHealthCheck({
      path: '/api/v1/health',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(10),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Allow ECS task to connect to RDS
    dbInstance.connections.allowFrom(
      fargateService.service,
      ec2.Port.tcp(dbPort),
      'ECS Fargate to RDS',
    );

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'ALB DNS name — point your domain CNAME here',
    });

    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint',
    });

    new cdk.CfnOutput(this, 'ImageBucketName', {
      value: imageBucket.bucketName,
      description: 'S3 bucket for listing images',
    });

    new cdk.CfnOutput(this, 'AppSecretsArn', {
      value: appSecrets.secretArn,
      description: 'Secrets Manager ARN for application secrets',
    });

    if (dbInstance.secret) {
      new cdk.CfnOutput(this, 'DbSecretsArn', {
        value: dbInstance.secret.secretArn,
        description: 'Secrets Manager ARN for database credentials',
      });
    }
  }
}
