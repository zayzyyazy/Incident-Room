export const DEFAULT_MONGO_DB = "bands_hackathon_db";
export const CHATS_COLLECTION = "chats";

export function getMongoDbName(): string {
  return process.env.MONGO_DB?.trim() || DEFAULT_MONGO_DB;
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}
