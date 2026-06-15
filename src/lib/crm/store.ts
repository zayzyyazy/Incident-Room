import fs from "node:fs";
import path from "node:path";
import {
  CrmCustomer,
  CrmCustomerSchema,
  CrmDatabaseSchema,
} from "@/lib/crm/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const CRM_PATH = path.join(DATA_DIR, "crm-customers.json");
const SEED_PATH = path.join(process.cwd(), "fixtures", "crm", "customers.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CRM_PATH)) {
    if (fs.existsSync(SEED_PATH)) {
      const seed = fs.readFileSync(SEED_PATH, "utf8");
      fs.writeFileSync(CRM_PATH, seed, "utf8");
    } else {
      fs.writeFileSync(
        CRM_PATH,
        JSON.stringify({ customers: [] }, null, 2),
        "utf8",
      );
    }
  }
}

function readDb() {
  ensureDataFile();
  const raw = fs.readFileSync(CRM_PATH, "utf8");
  return CrmDatabaseSchema.parse(JSON.parse(raw));
}

function writeDb(customers: CrmCustomer[]) {
  ensureDataFile();
  fs.writeFileSync(
    CRM_PATH,
    JSON.stringify({ customers }, null, 2),
    "utf8",
  );
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
