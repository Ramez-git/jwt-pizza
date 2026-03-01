# Curiosity Report: Deploying with Serverless Technologies

## Introduction

Throughout this course, we have deployed applications using CloudFront, S3, IAM roles, and CI/CD pipelines. Even though the cloud abstracts a lot of infrastructure, we were still responsible for managing servers, containers, networking, and scaling.

While learning about modern DevOps practices, I kept hearing the term serverless. At first, I assumed it meant “no servers,” which obviously cannot be true. After researching it more deeply, I realized that serverless is not about eliminating servers — it is about eliminating the need for developers to manage them.

This report explores what serverless deployment really means, how it works technically, and how it changes the responsibilities of DevOps engineers.

---

## What Serverless Actually Means

Serverless is a cloud execution model where:

- The cloud provider manages the infrastructure.
- Developers deploy code in small units (functions).
- Scaling happens automatically.
- Billing is based on execution time rather than uptime.

Instead of provisioning virtual machines, configuring operating systems, setting up scaling groups, and maintaining load balancers, you upload functions and define triggers.

Major cloud providers offer serverless platforms, such as:

- Amazon Web Services (AWS Lambda)
- Google Cloud (Cloud Functions)
- Microsoft Azure (Azure Functions)

The most common model is called Function as a Service (FaaS).

---

## How Serverless Works

Here is the mental model I built while researching:

1. An event occurs (an HTTP request, file upload, database update, etc.).
2. The cloud provider creates an execution environment.
3. Your function runs.
4. The environment shuts down immediately after execution.

You are billed only for the milliseconds your code runs.

There is no persistent server sitting idle waiting for requests.

For example:

- A user uploads an image to S3.
- A Lambda function automatically resizes the image.
- Once processing is complete, the function terminates.

This is fundamentally different from running a Node.js or Express server continuously on a VM.

---

## Traditional Deployment vs Serverless Deployment

### Traditional Deployment

In a typical DevOps pipeline, we might:

- Build a Docker image
- Push it to a container registry
- Deploy to a virtual machine or container service
- Configure networking and load balancing
- Manage scaling policies
- Monitor uptime and server health

Even with automation, we are still responsible for infrastructure behavior and lifecycle management.

---

### Serverless Deployment

With serverless, the process looks more like:

- Upload function code
- Define an event trigger (API Gateway, S3 event, etc.)
- Configure IAM permissions
- Deploy

There is no operating system to patch.
No container orchestration to manage.
No auto scaling groups to configure.

Concurrency and scaling are handled automatically by the cloud provider.

---

## Why This Matters in DevOps

Serverless changes what DevOps focuses on.

Traditional DevOps emphasizes:

- Server provisioning
- Load balancing
- Container orchestration
- Infrastructure uptime

Serverless DevOps shifts the emphasis toward:

- Event driven architecture
- Observability and logging
- IAM security boundaries
- Infrastructure as Code (IaC)
- Designing stateless systems

The complexity does not disappear — it moves. Instead of managing machines, engineers must design clean, secure, event-based systems.

---

## Advantages of Serverless

### 1. Automatic Scaling

If 10 users send requests, the system handles 10 executions.
If 10,000 users send requests, the system scales automatically.

There is no need to manually configure scaling rules.

This is extremely powerful for unpredictable traffic patterns.

---

### 2. Cost Efficiency

Traditional servers cost money as long as they are running, even if they are idle.

Serverless functions cost money only when they execute.

If no one uses your service, you pay almost nothing.

For startups or experimental projects, this significantly reduces financial risk.

---

### 3. Reduced Operational Overhead

You do not manage:

- Kernel patches
- OS updates
- Container runtime vulnerabilities
- Server monitoring for uptime

This reduces operational complexity and allows teams to focus on business logic.

---

## Trade Offs and Limitations

Serverless is not a perfect solution.

### Cold Starts

If a function has not been invoked recently, the platform may need time to initialize the execution environment. This delay is known as a cold start and can introduce latency.

For high performance systems, this may be problematic.

---

### Vendor Lock In

Serverless implementations are often tightly integrated with a specific cloud provider’s ecosystem.

Code written for AWS Lambda, for example, is not easily portable to Azure Functions without modification.

This creates strategic dependency on a vendor.

---

### Execution Time Limits

Most serverless platforms impose maximum execution time limits (often around 15 minutes).

Long running background processes are not ideal for serverless environments.

---

## Example Serverless Architecture

A fully serverless web application might include:

- S3 for static frontend hosting
- CloudFront as a CDN
- Lambda for backend APIs
- API Gateway for routing
- DynamoDB for database storage

In this architecture:

- There are no EC2 instances.
- No Docker containers are required.
- No traditional server infrastructure is manually managed.

The system is fully event driven and scales automatically.

---

## Personal Reflection

Before researching this topic, I assumed serverless was mostly marketing terminology. After digging deeper, I now see that it represents a significant shift in cloud deployment philosophy.

Instead of asking:

"How do we scale servers?"

We ask:

"How do we design systems that respond to events efficiently and securely?"

Serverless removes infrastructure management but increases architectural responsibility. Engineers must think carefully about:

- Stateless design
- Proper IAM permissions
- Event triggers
- Logging and monitoring strategies

In many ways, serverless requires stronger architectural discipline.

I also realized that many of the technologies we used in this course — such as S3, CloudFront, and IAM — are foundational pieces of serverless systems. We were already working toward serverless patterns, even if we were still managing some infrastructure layers manually.

Overall, serverless is not always the correct solution, but when used appropriately, it simplifies deployment, scaling, and cost management in powerful ways.

---

## Conclusion

Serverless technologies represent an evolution in cloud deployment. They abstract infrastructure management and shift focus toward event driven system design.

For DevOps engineers, this means spending less time managing servers and more time designing secure, scalable, maintainable architectures.

Understanding serverless is important not because it replaces traditional deployments entirely, but because it expands the range of tools available to modern engineers.

---

## References

- Amazon Web Services Documentation
- Google Cloud Documentation
- Microsoft Azure Documentation
- Official cloud architecture whitepapers