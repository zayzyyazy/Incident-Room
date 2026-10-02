import { z } from "zod";

export const CrmOpenTicketSchema = z.object({
  id: z.string(),
  status: z.string(),
  subject: z.string(),
});

export const CrmCustomerSchema = z.object({
  customer_id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  birth_date: z.string().optional(),
  address: z.string().optional(),
  vnr_last4: z.string().optional(),
  prior_calls_14d: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  open_tickets: z.array(CrmOpenTicketSchema).optional(),
});

export const CrmDatabaseSchema = z.object({
  customers: z.array(CrmCustomerSchema),
});

export type CrmCustomer = z.infer<typeof CrmCustomerSchema>;
export type CrmDatabase = z.infer<typeof CrmDatabaseSchema>;

export type CrmLookupHints = {
  customer_id?: string;
  phone?: string;
  email?: string;
  vnr_last4?: string;
  name?: string;
};

export type CrmLookupResult = {
  matched: boolean;
  matched_on?: string;
  customer?: CrmCustomer;
  hints_used: CrmLookupHints;
};

export type IncidentCrmLink = {
  customer_id: string;
  matched_on: string;
  customer: CrmCustomer;
  resolved_at: string;
};
