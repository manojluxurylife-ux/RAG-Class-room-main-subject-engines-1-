import { google } from "googleapis";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function adkCloudTasksConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLOUD_PROJECT_ID &&
    process.env.CLOUD_TASKS_LOCATION &&
    process.env.CLOUD_TASKS_QUEUE &&
    process.env.ADK_WORKER_URL &&
    process.env.ADK_TASKS_SERVICE_ACCOUNT,
  );
}

export async function enqueueAdkMaterialJob(payload: { jobId: string; userId: string }): Promise<string> {
  const project = required("GOOGLE_CLOUD_PROJECT_ID");
  const location = required("CLOUD_TASKS_LOCATION");
  const queue = required("CLOUD_TASKS_QUEUE");
  const workerUrl = required("ADK_WORKER_URL").replace(/\/$/, "");
  const serviceAccountEmail = required("ADK_TASKS_SERVICE_ACCOUNT");

  const inlineCredentials = process.env.GOOGLE_CLOUD_KEY_JSON
    ? JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON)
    : undefined;
  const auth = new google.auth.GoogleAuth({
    credentials: inlineCredentials,
    projectId: project,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const parent = `projects/${project}/locations/${location}/queues/${queue}`;
  const response = await client.request<{ name?: string }>({
    url: `https://cloudtasks.googleapis.com/v2/${parent}/tasks`,
    method: "POST",
    data: {
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: `${workerUrl}/process`,
          headers: { "Content-Type": "application/json" },
          body: Buffer.from(JSON.stringify(payload)).toString("base64"),
          oidcToken: {
            serviceAccountEmail,
            audience: workerUrl,
          },
        },
        dispatchDeadline: "1800s",
      },
    },
  });
  return response.data.name || "queued";
}
