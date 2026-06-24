import fs from "node:fs";
import path from "node:path";
import {
  CrmCustomer,
  CrmCustomerSchema,
  CrmDatabaseSchema,
} from "@/lib/crm/types";
import { getMongoDb } from "@/lib/mongodb";
import { CRM_COLLECTION, isMongoConfigured } from "@/lib/mongodb/config";

const SEED_PATH = path.join(process.cwd(), "fixtures", "crm", "customers.json");
let localCustomers: CrmCustomer[] | null = null;

function readSeedDb() {
  if (!fs.existsSync(SEED_PATH)) {
    return { customers: [] };
  }
  const raw = fs.readFileSync(SEED_PATH, "utf8");
  return CrmDatabaseSchema.parse(JSON.parse(raw));
}

function readDb() {
  if (!localCustomers) {
    localCustomers = readSeedDb().customers;
  }

  return { customers: localCustomers };
}

function writeDb(customers: CrmCustomer[]) {
  localCustomers = customers;
}

export function listCrmCustomers(): CrmCustomer[] {
  return readDb().customers;
}

export function getCrmCustomer(customerId: string): CrmCustomer | undefined {
  return readDb().customers.find((c) => c.customer_id === customerId);
}

export function upsertCrmCustomer(input: unknown): CrmCustomer {
  const customer = CrmCustomerSchema.parse(input);
  const db = readDb();
  const index = db.customers.findIndex(
    (c) => c.customer_id === customer.customer_id,
  );

  if (index === -1) {
    db.customers.push(customer);
  } else {
    db.customers[index] = customer;
  }

  writeDb(db.customers);
  return customer;
}

export function deleteCrmCustomer(customerId: string): boolean {
  const db = readDb();
  const next = db.customers.filter((c) => c.customer_id !== customerId);
  if (next.length === db.customers.length) {
    return false;
  }
  writeDb(next);
  return true;
}

export function generateCustomerId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return `cust_${slug || "customer"}_${Date.now().toString(36)}`;
}

/** Replace runtime CRM DB with fixture seed (demo reset). */
export function reseedCrmFromFixture(): CrmCustomer[] {
  localCustomers = readSeedDb().customers;
  return readDb().customers;
}

async function crmCollection() {
  const db = await getMongoDb();
  return db.collection<CrmCustomer>(CRM_COLLECTION);
}

export async function listCrmCustomersForRuntime(): Promise<CrmCustomer[]> {
  if (!isMongoConfigured()) {
    return listCrmCustomers();
  }

  const collection = await crmCollection();
  const existing = await collection.find({}).sort({ name: 1 }).toArray();
  if (existing.length > 0) {
    return existing.map((customer) => CrmCustomerSchema.parse(customer));
  }

  const seeded = readSeedDb().customers;
  if (seeded.length > 0) {
    await collection.insertMany(seeded);
  }
  return seeded;
}

export async function getCrmCustomerForRuntime(
  customerId: string,
): Promise<CrmCustomer | undefined> {
  if (!isMongoConfigured()) {
    return getCrmCustomer(customerId);
  }

  const collection = await crmCollection();
  const customer = await collection.findOne({ customer_id: customerId });
  return customer ? CrmCustomerSchema.parse(customer) : undefined;
}

export async function upsertCrmCustomerForRuntime(
  input: unknown,
): Promise<CrmCustomer> {
  const customer = CrmCustomerSchema.parse(input);
  if (!isMongoConfigured()) {
    return upsertCrmCustomer(customer);
  }

  const collection = await crmCollection();
  await collection.updateOne(
    { customer_id: customer.customer_id },
    { $set: customer },
    { upsert: true },
  );
  return customer;
}

export async function deleteCrmCustomerForRuntime(customerId: string): Promise<boolean> {
  if (!isMongoConfigured()) {
    return deleteCrmCustomer(customerId);
  }

  const collection = await crmCollection();
  const result = await collection.deleteOne({ customer_id: customerId });
  return result.deletedCount > 0;
}

export async function reseedCrmFromFixtureForRuntime(): Promise<CrmCustomer[]> {
  const seeded = readSeedDb().customers;
  if (!isMongoConfigured()) {
    return reseedCrmFromFixture();
  }

  const collection = await crmCollection();
  await collection.deleteMany({});
  if (seeded.length > 0) {
    await collection.insertMany(seeded);
  }
  return seeded;
}
