"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  FileQuestionIcon,
  GalleryVerticalEndIcon,
  LifeBuoyIcon,
  LoaderCircleIcon,
  MailIcon,
  PhoneIcon,
  ReceiptTextIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { GradientWaveText } from "@/components/gradient-wave-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  SmoothInput,
  SmoothTextarea,
} from "@/components/ui/skiper-ui/skiper106";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { getCurrentUser } from "@/lib/auth/api";
import {
  getStoredAuthSession,
  subscribeToAuthSessionChange,
} from "@/lib/auth/session";
import {
  createSupportTicket,
  listSupportTickets,
  type SupportTicket,
  type SupportTicketContactMethod,
  type SupportTicketSortBy,
  type SupportTicketSortDirection,
} from "@/lib/support/api";
import { cn } from "@/lib/utils";

type KnowledgeArticle = {
  title: string;
  description: string;
  category: string;
  keywords: string[];
  icon: React.ReactNode;
};

type TicketFormState = {
  subject: string;
  message: string;
  contactMethod: TicketContactMethod | "";
};

type SupportTab = "knowledge" | "tickets";
type TicketContactMethod = "email" | "phone";

type ContactOption = {
  method: TicketContactMethod;
  label: string;
  value: string;
  icon: React.ReactNode;
};

const popularSearchKeywords = [
  "POS billing",
  "GST filing",
  "Invoice download",
  "Stock issue",
  "Payment allocation",
  "Login issue",
];

const knowledgeBase: KnowledgeArticle[] = [
  {
    title: "POS bill not completing",
    description:
      "Check customer, payment amount, warehouse, GST rate, and stock tracking before posting a counter bill.",
    category: "Billing",
    keywords: ["pos", "billing", "sales", "counter", "payment"],
    icon: <ReceiptTextIcon className="size-4" />,
  },
  {
    title: "Purchase added but stock is not increasing",
    description:
      "Tracked goods need a warehouse. Posted purchase bills increase stock through the inventory engine.",
    category: "Inventory",
    keywords: ["purchase", "stock", "warehouse", "inventory", "goods"],
    icon: <BookOpenIcon className="size-4" />,
  },
  {
    title: "GST amount looks wrong",
    description:
      "GST split depends on place of supply. Same state uses CGST and SGST; different state uses IGST.",
    category: "GST",
    keywords: ["gst", "cgst", "sgst", "igst", "tax", "state"],
    icon: <ShieldCheckIcon className="size-4" />,
  },
  {
    title: "Payment is received but invoice is still open",
    description:
      "Record the receipt and allocate it to the receivable entry so outstanding becomes settled.",
    category: "Money",
    keywords: ["payment", "receipt", "receivable", "allocation", "outstanding"],
    icon: <CheckCircle2Icon className="size-4" />,
  },
  {
    title: "Unable to login to workspace",
    description:
      "Use the workspace URL shown after lookup. Staff users must login only to their assigned tenant.",
    category: "Account",
    keywords: ["login", "workspace", "tenant", "password", "account"],
    icon: <LifeBuoyIcon className="size-4" />,
  },
  {
    title: "Invoice PDF details missing",
    description:
      "Invoice layout uses business settings, party details, GST registration, invoice logo, and watermark settings.",
    category: "Invoices",
    keywords: ["invoice", "pdf", "logo", "watermark", "template"],
    icon: <FileQuestionIcon className="size-4" />,
  },
];

const initialTicketForm: TicketFormState = {
  subject: "",
  message: "",
  contactMethod: "",
};

export function SupportPage() {
  const [query, setQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<SupportTab>("knowledge");
  const [ticketSortBy, setTicketSortBy] =
    React.useState<SupportTicketSortBy>("createdAt");
  const [ticketSortDirection, setTicketSortDirection] =
    React.useState<SupportTicketSortDirection>("desc");
  const [ticketOpen, setTicketOpen] = React.useState(false);
  const [ticketForm, setTicketForm] =
    React.useState<TicketFormState>(initialTicketForm);
  const queryClient = useQueryClient();
  const sessionSnapshot = React.useSyncExternalStore(
    subscribeToAuthSessionChange,
    getStoredAuthSession,
    () => null,
  );
  const accessToken = sessionSnapshot?.session.accessToken ?? "";
  const accountType = sessionSnapshot?.accountType === "ca" ? "ca" : "business";
  const currentUserQuery = useQuery({
    queryKey: [
      "auth",
      "current-user",
      sessionSnapshot?.accountType ?? "business",
      sessionSnapshot?.user.id ?? "",
    ],
    queryFn: () => getCurrentUser(accessToken),
    enabled: accessToken.length > 0 && Boolean(sessionSnapshot?.user.id),
    staleTime: 1000 * 60 * 5,
  });
  const supportTicketsQuery = useQuery({
    queryKey: [
      "support",
      "tickets",
      accountType,
      sessionSnapshot?.user.id ?? "",
      ticketSortBy,
      ticketSortDirection,
    ],
    queryFn: () =>
      listSupportTickets(accessToken, {
        accountType,
        sortBy: ticketSortBy,
        sortDirection: ticketSortDirection,
      }),
    enabled: accessToken.length > 0 && Boolean(sessionSnapshot?.user.id),
    staleTime: 1000 * 30,
  });
  const tickets = supportTicketsQuery.data?.tickets ?? [];
  const activeMembership =
    currentUserQuery.data?.memberships.find(
      (membership) => membership.business_id === sessionSnapshot?.tenant?.id,
    ) ??
    currentUserQuery.data?.memberships.find(
      (membership) => membership.status === "active",
    );
  const workspaceName =
    activeMembership?.business_name ??
    sessionSnapshot?.tenant?.tradeName ??
    sessionSnapshot?.tenant?.legalName ??
    "GSTFY workspace";
  const tenantUrl =
    activeMembership?.tenant_url ?? sessionSnapshot?.tenant?.url ?? null;
  const emailContact =
    currentUserQuery.data?.profile?.email ?? sessionSnapshot?.user.email ?? null;
  const phoneContact =
    currentUserQuery.data?.profile?.phone_e164 ?? sessionSnapshot?.user.phone ?? null;
  const contactOptions = React.useMemo<ContactOption[]>(
    () => {
      const options: ContactOption[] = [];

      if (emailContact) {
        options.push({
          method: "email",
          label: "Email",
          value: emailContact,
          icon: <MailIcon className="size-4" />,
        });
      }

      if (phoneContact) {
        options.push({
          method: "phone",
          label: "Phone",
          value: phoneContact,
          icon: <PhoneIcon className="size-4" />,
        });
      }

      return options;
    },
    [emailContact, phoneContact],
  );
  const selectedContactMethod =
    ticketForm.contactMethod || contactOptions[0]?.method || "";
  const selectedContact =
    contactOptions.find((option) => option.method === selectedContactMethod)?.value ??
    "";
  const visibleArticles = React.useMemo(
    () => filterArticles(knowledgeBase, query),
    [query],
  );
  const canCreateTicket =
    accessToken.length > 0 &&
    ticketForm.subject.trim().length >= 3 &&
    ticketForm.message.trim().length >= 10;
  const createTicketMutation = useMutation({
    mutationFn: () =>
      createSupportTicket(accessToken, {
        accountType,
        subject: ticketForm.subject.trim(),
        message: ticketForm.message.trim(),
        contactMethod:
          (selectedContactMethod || "none") as SupportTicketContactMethod,
        contactValue: selectedContact || null,
        workspaceName,
        tenantUrl,
        pageUrl: getCurrentPageUrl(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support", "tickets"],
      });
      setActiveTab("tickets");
      setTicketOpen(false);
      setTicketForm(initialTicketForm);
      toast.success("Ticket created", {
        description: "GSTFY support can now review it from the admin side.",
      });
    },
    onError: (error) => {
      toast.error("Unable to create ticket", {
        description:
          error instanceof Error ?
            error.message
          : "Please try again in a few seconds.",
      });
    },
  });

  function openTicketDialog(prefillSubject = "") {
    setTicketForm({
      ...initialTicketForm,
      subject: prefillSubject,
      contactMethod: contactOptions[0]?.method ?? "",
    });
    setTicketOpen(true);
  }

  function createTicket() {
    if (!canCreateTicket || createTicketMutation.isPending) {
      return;
    }

    createTicketMutation.mutate();
  }

  function handleTicketSortChange(nextSortBy: SupportTicketSortBy) {
    if (ticketSortBy === nextSortBy) {
      setTicketSortDirection(ticketSortDirection === "asc" ? "desc" : "asc");
      return;
    }

    setTicketSortBy(nextSortBy);
    setTicketSortDirection(nextSortBy === "createdAt" ? "desc" : "asc");
  }

  return (
    <main className="h-[calc(100dvh-4rem)] overflow-hidden bg-[linear-gradient(135deg,rgba(239,246,255,0.85),rgba(255,255,255,0.96)_46%,rgba(219,234,254,0.7))] px-4 py-4 text-foreground dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96)_46%,rgba(30,58,138,0.28))] sm:px-6 lg:px-8">
      <motion.section
        className="mx-auto flex h-full w-full max-w-6xl flex-col"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="px-2 py-5 text-center sm:py-6">
          <div className="mx-auto max-w-2xl">
            <div className="mx-auto flex w-fit text-blue-700 dark:text-blue-200">
              <span className="flex size-9 items-center justify-center rounded-xl border border-blue-100 bg-white/60 backdrop-blur dark:border-blue-900/60 dark:bg-slate-950/50">
                <GalleryVerticalEndIcon className="size-5" />
                <span className="sr-only">GSTFY</span>
              </span>
            </div>
            <GradientWaveText
              repeat
              speed={0.55}
              customColors={["#1d4ed8", "#38bdf8", "#2563eb", "#0f172a"]}
              className="mt-3 h-auto min-h-0 text-2xl font-semibold leading-tight tracking-tight [--gradient-wave-base:rgb(15,23,42)] dark:[--gradient-wave-base:rgb(255,255,255)] sm:text-3xl"
            >
              Find an answer or create a ticket
            </GradientWaveText>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Search help articles for billing, GST, inventory, payments, and
              login. If nothing matches, create a ticket from the same row.
            </p>
          </div>

          <div className="mx-auto mt-5 flex w-full max-w-2xl items-center justify-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-input bg-background/60 px-3 py-1.5 backdrop-blur">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <SmoothInput
                value={query}
                placeholder="Search knowledge base..."
                wrapperClassName="min-w-0 flex-1"
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="mx-auto mt-3 flex w-full max-w-2xl flex-wrap items-center justify-center gap-2">
            {popularSearchKeywords.map((keyword) => {
              const isSelected =
                query.trim().toLowerCase() === keyword.toLowerCase();

              return (
                <button
                  key={keyword}
                  type="button"
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    isSelected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-blue-100 bg-background/55 text-blue-800 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-slate-950/45 dark:text-blue-200 dark:hover:bg-blue-950/55",
                  )}
                  onClick={() => {
                    setQuery(keyword);
                    setActiveTab("knowledge");
                  }}
                >
                  {keyword}
                </button>
              );
            })}
          </div>
        </header>

        <Tabs
          value={activeTab}
          defaultValue="knowledge"
          className="mt-2 min-h-0 flex-1 gap-2"
          onValueChange={(value) => setActiveTab(value as SupportTab)}
        >
          <div className="flex justify-end px-1">
            <TabsList className="h-8 border-border bg-background/50 p-0.5 backdrop-blur">
              <TabsTrigger
                value="tickets"
                className="min-w-0 rounded-lg px-3 py-1 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                Tickets
                {tickets.length > 0 ? (
                  <span
                    className={cn(
                      "ml-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                      activeTab === "tickets"
                        ? "bg-white/20 text-white"
                        : "bg-blue-600 text-white",
                    )}
                  >
                    {tickets.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="knowledge"
                className="min-w-0 rounded-lg px-3 py-1 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                Knowledge base
              </TabsTrigger>
            </TabsList>
          </div>

          <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            <TabsContent value="knowledge" className="m-0 h-full">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div>
                  <h2 className="text-sm font-semibold">Knowledge base</h2>
                  <p className="text-xs text-muted-foreground">
                    Showing {visibleArticles.length} of {knowledgeBase.length} help articles
                  </p>
                </div>
                {query.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    onClick={() => setQuery("")}
                  >
                    Clear search
                  </Button>
                ) : null}
              </div>

              <div className="h-full overflow-y-auto p-4">
                {visibleArticles.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleArticles.map((article, index) => (
                      <motion.button
                        key={article.title}
                        type="button"
                        className="group rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: index * 0.025 }}
                        onClick={() => openTicketDialog(article.title)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                            {article.icon}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                            {article.category}
                          </span>
                        </div>
                        <h3 className="mt-4 text-sm font-semibold">{article.title}</h3>
                        <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-muted-foreground">
                          {article.description}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-foreground">
                          Need more help? Create ticket
                          <ArrowRightIcon className="size-3.5" />
                        </span>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <Empty className="min-h-[22rem] border-0">
                    <EmptyHeader>
                      <EmptyMedia
                        variant="icon"
                        className="bg-muted text-muted-foreground"
                      >
                        <SearchIcon />
                      </EmptyMedia>
                      <EmptyTitle>No help article found</EmptyTitle>
                      <EmptyDescription>
                        Create a ticket and include the screen name, what you tried,
                        and what happened.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        type="button"
                        className="h-9"
                        onClick={() => openTicketDialog(query.trim())}
                      >
                        Create ticket
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tickets" className="m-0 h-full">
              <TicketsTable
                tickets={tickets}
                isLoading={supportTicketsQuery.isLoading}
                sortBy={ticketSortBy}
                sortDirection={ticketSortDirection}
                onSortChange={handleTicketSortChange}
                onCreate={() => openTicketDialog(query.trim())}
              />
            </TabsContent>
          </section>
        </Tabs>
      </motion.section>

      <CreateTicketDialog
        open={ticketOpen}
        form={ticketForm}
        contactOptions={contactOptions}
        selectedContactMethod={selectedContactMethod}
        canCreateTicket={canCreateTicket && !createTicketMutation.isPending}
        isCreating={createTicketMutation.isPending}
        onOpenChange={setTicketOpen}
        onFormChange={setTicketForm}
        onSubmit={createTicket}
      />
    </main>
  );
}

function TicketsTable({
  tickets,
  isLoading,
  sortBy,
  sortDirection,
  onSortChange,
  onCreate,
}: {
  tickets: SupportTicket[];
  isLoading: boolean;
  sortBy: SupportTicketSortBy;
  sortDirection: SupportTicketSortDirection;
  onSortChange: (sortBy: SupportTicketSortBy) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Tickets</h2>
          <p className="text-xs text-muted-foreground">
            Support tickets created from this workspace.
          </p>
        </div>
        <Button type="button" size="sm" className="h-8" onClick={onCreate}>
          New ticket
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-2 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 rounded-xl" />
          ))}
        </div>
      ) : tickets.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table className="w-full table-fixed text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-8 [&_th]:px-3">
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[62%]">
                  <TicketSortButton
                    label="Subject"
                    sortBy="subject"
                    activeSortBy={sortBy}
                    sortDirection={sortDirection}
                    onClick={onSortChange}
                  />
                </TableHead>
                <TableHead className="w-[20%]">
                  <TicketSortButton
                    label="Created"
                    sortBy="createdAt"
                    activeSortBy={sortBy}
                    sortDirection={sortDirection}
                    onClick={onSortChange}
                  />
                </TableHead>
                <TableHead className="w-[18%] pr-4 text-right">
                  <TicketSortButton
                    label="Status"
                    sortBy="status"
                    activeSortBy={sortBy}
                    sortDirection={sortDirection}
                    align="right"
                    onClick={onSortChange}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <p className="truncate font-medium">{ticket.subject}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {ticket.id}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTicketDate(ticket.createdAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <span className={getTicketStatusClassName(ticket.status)}>
                      {formatTicketStatus(ticket.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty className="min-h-[22rem] flex-1 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailIcon />
            </EmptyMedia>
            <EmptyTitle>No tickets created yet</EmptyTitle>
            <EmptyDescription>
              Open a support ticket when the help articles do not solve the issue.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" className="h-9" onClick={onCreate}>
              Create ticket
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}

function TicketSortButton({
  label,
  sortBy,
  activeSortBy,
  sortDirection,
  align = "left",
  onClick,
}: {
  label: string;
  sortBy: SupportTicketSortBy;
  activeSortBy: SupportTicketSortBy;
  sortDirection: SupportTicketSortDirection;
  align?: "left" | "right";
  onClick: (sortBy: SupportTicketSortBy) => void;
}) {
  const isActive = activeSortBy === sortBy;
  const SortIcon =
    !isActive ? ArrowDownUpIcon
    : sortDirection === "asc" ? ArrowUpIcon
    : ArrowDownIcon;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive ? "text-blue-600" : "text-foreground",
        align === "right" && "ml-auto justify-end text-right",
      )}
      onClick={() => onClick(sortBy)}
    >
      <span className="truncate">{label}</span>
      <SortIcon
        className={cn(
          "size-3 shrink-0",
          isActive ? "text-blue-600" : "text-muted-foreground/70",
        )}
      />
    </button>
  );
}

function CreateTicketDialog({
  open,
  form,
  contactOptions,
  selectedContactMethod,
  canCreateTicket,
  isCreating,
  onOpenChange,
  onFormChange,
  onSubmit,
}: {
  open: boolean;
  form: TicketFormState;
  contactOptions: ContactOption[];
  selectedContactMethod: TicketContactMethod | "";
  canCreateTicket: boolean;
  isCreating: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: React.Dispatch<React.SetStateAction<TicketFormState>>;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create support ticket</DialogTitle>
          <DialogDescription>
            Add the exact screen and issue. We will use this as the ticket draft.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium">Subject *</span>
            <SmoothInput
              value={form.subject}
              placeholder="Example: POS checkout payment mismatch"
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  subject: event.target.value,
                }))
              }
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium">Details *</span>
            <SmoothTextarea
              value={form.message}
              rows={5}
              maxLength={2000}
              placeholder="Tell us what you tried, what happened, and the expected result."
              className="min-h-32 resize-none"
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  message: event.target.value,
                }))
              }
            />
          </label>

          <div className="grid gap-1.5">
            <span className="text-xs font-medium">Preferred contact</span>
            {contactOptions.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {contactOptions.map((option) => {
                  const selected = selectedContactMethod === option.method;

                  return (
                    <button
                      key={option.method}
                      type="button"
                      aria-pressed={selected}
                      className={[
                        "flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                        selected ?
                          "border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-50"
                        : "border-border bg-muted/20 hover:bg-muted/40",
                      ].join(" ")}
                      onClick={() =>
                        onFormChange((current) => ({
                          ...current,
                          contactMethod: option.method,
                        }))
                      }
                    >
                      <span
                        className={[
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          selected ?
                            "bg-blue-600 text-white"
                          : "bg-background text-muted-foreground",
                        ].join(" ")}
                      >
                        {option.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">{option.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.value}
                        </span>
                      </span>
                      {selected ? (
                        <CheckCircle2Icon className="size-4 shrink-0 text-blue-600" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                No account email or phone is saved. Support will use the email
                client you send from.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!canCreateTicket}
            onClick={onSubmit}
          >
            {isCreating ?
              <LoaderCircleIcon className="size-4 animate-spin" />
            : <>
                <MailIcon className="size-4" />
                Create ticket
              </>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatTicketDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTicketStatus(value: SupportTicket["status"]) {
  if (value === "in_review") {
    return "In review";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTicketStatusClassName(value: SupportTicket["status"]) {
  return cn(
    "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
    value === "open" &&
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    value === "in_review" &&
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    value === "resolved" &&
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    value === "closed" &&
      "border-border bg-muted text-muted-foreground",
  );
}

function filterArticles(articles: KnowledgeArticle[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return articles;
  }

  return articles.filter((article) => {
    const searchableText = [
      article.title,
      article.description,
      article.category,
      ...article.keywords,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

function getCurrentPageUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return `${window.location.pathname}${window.location.search}`;
}
