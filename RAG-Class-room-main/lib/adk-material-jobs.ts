import { collectionHelpers } from "./firestore-collection";

export type AdkJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type AdkMaterialJob = {
  id: string;
  ownerId: string;
  status: AdkJobStatus;
  stage: string;
  progress: number;
  input: Record<string, unknown>;
  prompt: string;
  result?: unknown;
  error?: string;
  taskName?: string;
  lockExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
};

const jobs = collectionHelpers<AdkMaterialJob>("adkMaterialJobs");

export const adkMaterialJobs = {
  async create(record: Omit<AdkMaterialJob, "id">): Promise<AdkMaterialJob> {
    return await jobs.create(record);
  },
  async byId(id: string): Promise<AdkMaterialJob | null> {
    return await jobs.byId(id);
  },
  async update(id: string, patch: Partial<AdkMaterialJob>): Promise<AdkMaterialJob | null> {
    return await jobs.update(id, patch);
  },
};
