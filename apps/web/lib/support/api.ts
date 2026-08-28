import { apiRequest } from "@/lib/api/client";

export type SupportTicketSortBy = "createdAt" | "subject" | "status";
export type SupportTicketSortDirection = "asc" | "desc";
export type SupportTicketContactMethod = "email" | "phone" | "none";

export type SupportTicket = {
  id: string;
  accountType: "business" | "ca";
  subject: string;
  message: string;
  contactMethod: SupportTicketContactMethod;
  contactValue: string | null;
  workspaceName: string | null;
  tenantUrl: string | null;
  pageUrl: string | null;
  status: "open" | "in_review" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
};

export type CreateSupportTicketPayload = {
  accountType: "business" | "ca";
  subject: string;
  message: string;
  contactMethod: SupportTicketContactMethod;
  contactValue?: string | null;
  workspaceName?: string | null;
  tenantUrl?: string | null;
  pageUrl?: string | null;
};

export type ListSupportTicketsParams = {
  accountType: "business" | "ca";
  sortBy: SupportTicketSortBy;
  sortDirection: SupportTicketSortDirection;
  limit?: number;
};

export function listSupportTickets(
  accessToken: string,
  params: ListSupportTicketsParams,
) {
  const query = new URLSearchParams({
    accountType: params.accountType,
    sortBy: params.sortBy,
    sortDirection: params.sortDirection,
    limit: String(params.limit ?? 50),
  });

  return apiRequest<{ tickets: SupportTicket[] }>(
    `/support/tickets?${query.toString()}`,
    {
      accessToken,
    },
  );
}

export function createSupportTicket(
  accessToken: string,
  payload: CreateSupportTicketPayload,
) {
  return apiRequest<{ ticket: SupportTicket }>("/support/tickets", {
    method: "POST",
    body: payload,
    accessToken,
  });
}
