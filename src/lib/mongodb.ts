import { MongoClient, type Collection, type Db } from "mongodb";
import { CHATS_COLLECTION, getMongoDbName } from "@/lib/mongodb/config";

const options = {};

let clientPromise: Promise<MongoClient> | undefined;

function getUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local");
  }
  return uri;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    const uri = getUri();
    if (process.env.NODE_ENV === "development") {
      const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
      };
      if (!globalWithMongo._mongoClientPromise) {
        const client = new MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = client.connect();
      }
      clientPromise = globalWithMongo._mongoClientPromise;
    } else {
      const client = new MongoClient(uri, options);
      clientPromise = client.connect();
    }
  }
  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getMongoDbName());
}

export async function getChatsCollection(): Promise<Collection> {
  const db = await getMongoDb();
  return db.collection(CHATS_COLLECTION);
}

/** @deprecated Use getMongoClient() — kept for older imports */
export default getMongoClient;
