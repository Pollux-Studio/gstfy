import { getStatusOverview, getServices, getIncidents } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Timeline, TimelineContent, TimelineDescription, TimelineIcon, TimelineItem, TimelineTime, TimelineTitle } from "@/components/timeline";
import { CheckCircle2, ShieldAlert, Wrench, Activity, SearchX } from "lucide-react";
import { format } from "date-fns";
import { Status, StatusIndicator, StatusLabel } from "@/components/kibo-ui/status";
import { Pill, PillIndicator } from "@/components/kibo-ui/pill";
import { Signature } from "@/components/signature";
import { EmptyState } from "@/components/empty-state";

export const dynamic = 'force-dynamic';

type Service = {
  id: string;
  name: string;
  status: string;
};

type ServiceGroup = {
  id: string;
  name: string;
  services: Service[];
};

type Incident = {
  id: string;
  title: string;
  status: string;
  impact: string;
  message?: string;
  createdAt: string;
};

export default async function StatusPage() {
  // Fetch data in parallel
  const [overview, servicesData, incidentsData] = await Promise.all([
    getStatusOverview().catch(() => ({ status: "unknown", label: "Unable to fetch status" })),
    getServices().catch(() => ({ groups: [] })),
    getIncidents().catch(() => ({ items: [] }))
  ]);

  const groups = servicesData.groups || [];
  const incidents = incidentsData.items || [];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "operational":
        return { kiboStatus: "online" as const, pillVariant: "success" as const, pulse: false, color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 };
      case "degraded":
      case "degraded_performance":
      case "partial_outage":
        return { kiboStatus: "degraded" as const, pillVariant: "warning" as const, pulse: true, color: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400", icon: ShieldAlert };
      case "major_outage":
        return { kiboStatus: "offline" as const, pillVariant: "error" as const, pulse: true, color: "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400", icon: ShieldAlert };
      case "maintenance":
        return { kiboStatus: "maintenance" as const, pillVariant: "info" as const, pulse: false, color: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400", icon: Wrench };
      default:
        return { kiboStatus: "offline" as const, pillVariant: "error" as const, pulse: false, color: "bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-400", icon: Activity };
    }
  };

  const overviewConfig = getStatusConfig(overview.status);

  return (
    <div className="space-y-12 pb-16">
      {/* Banner */}
        <section className="relative overflow-hidden rounded-xl border shadow-sm">
          <div className={`relative p-6 flex flex-col md:flex-row items-center justify-between gap-4 ${overviewConfig.color}`}>
            <div className="flex items-center gap-4">
              <Status status={overviewConfig.kiboStatus} className="text-sm py-1 px-3 border-none bg-transparent shadow-none">
                <StatusIndicator className="scale-150" />
              </Status>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{overview.label}</h2>
                <p className="text-sm opacity-80 mt-1">Refreshed automatically.</p>
              </div>
            </div>
          </div>
        </section>

      {/* Services */}
      <section>
        <h3 className="text-xl font-bold tracking-tight mb-6">System Status</h3>
        <Card className="shadow-sm">
          <CardContent className="p-0">
            {groups.length === 0 ? (
              <EmptyState 
                icon={SearchX} 
                title="No Services Found" 
                description="Unable to connect to API or no services have been configured yet." 
              />
            ) : (
              groups.map((group: ServiceGroup, idx: number) => (
                <div key={group.id}>
                  <div className="p-6">
                    <h4 className="font-semibold text-lg mb-4">{group.name}</h4>
                    <div className="space-y-4">
                      {group.services.map((service: Service) => {
                        const serviceConfig = getStatusConfig(service.status);
                        return (
                          <div key={service.id} className="flex items-center justify-between">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{service.name}</span>
                            <Pill>
                              <PillIndicator variant={serviceConfig.pillVariant} pulse={serviceConfig.pulse} />
                              <span className="capitalize">{service.status.replace('_', ' ')}</span>
                            </Pill>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {idx < groups.length - 1 && <Separator />}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Timeline / Incidents */}
      <section>
        <h3 className="text-xl font-bold tracking-tight mb-6">Past Incidents</h3>
        {incidents.length === 0 ? (
          <EmptyState 
            icon={CheckCircle2} 
            title="No recent incidents" 
            description="All systems have been fully operational over the past 30 days." 
          />
        ) : (
          <Timeline>
            {incidents.map((incident: Incident) => {
              const incidentConfig = getStatusConfig(incident.impact);
              const IncidentIcon = incidentConfig.icon;
              return (
                <TimelineItem key={incident.id}>
                  <TimelineIcon>
                    <IncidentIcon className="w-5 h-5" />
                  </TimelineIcon>
                  <TimelineContent>
                    <TimelineTime>{format(new Date(incident.createdAt), "MMM d, yyyy • h:mm a")}</TimelineTime>
                    <TimelineTitle>{incident.title}</TimelineTitle>
                    <TimelineDescription>
                      <div className="mb-3">
                        <Pill>
                          <PillIndicator variant={incidentConfig.pillVariant} pulse={incidentConfig.pulse} />
                          <span className="capitalize">{incident.status}</span>
                        </Pill>
                      </div>
                      {incident.message && <p>{incident.message}</p>}
                    </TimelineDescription>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
        )}
      </section>
      
      {/* Signature */}
      <div className="flex justify-center mt-20">
        <Signature text="Gstfy" fontSize={24} duration={4} color="#4f46e5" />
      </div>
    </div>
  );
}
