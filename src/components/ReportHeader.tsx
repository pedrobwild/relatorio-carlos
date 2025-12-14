import bwildLogo from "@/assets/bwild-logo.png";
import { FileText, Box, Ruler, DollarSign, Headphones, User, Phone, Calendar, ChevronRight } from "lucide-react";
import { Activity } from "@/types/report";

interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  reportDate: string;
  activities: Activity[];
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
};

const ReportHeader = ({
  projectName,
  unitName,
  clientName,
  startDate,
  endDate,
  reportDate,
  activities,
}: ReportHeaderProps) => {
  const quickLinks = [
    { icon: FileText, label: "Contrato", href: "#contrato" },
    { icon: Box, label: "Projeto 3D", href: "#projeto-3d" },
    { icon: Ruler, label: "Projeto Executivo", href: "#projeto-executivo" },
    { icon: DollarSign, label: "Financeiro", href: "#financeiro" },
    { icon: Headphones, label: "Suporte", href: "#suporte" },
  ];

  const teamContacts = [
    { role: "Engenheiro", name: "Lucas Tresmondi", phone: "(99) 99999-9999" },
    { role: "Gerente", name: "Victorya Capponi", phone: "(99) 99999-9999" },
  ];

  const dateMetrics = [
    { label: "Início", value: "01/07/2025" },
    { label: "Término", value: "14/09/2025" },
    { label: "Atualização", value: "08/09/2025" },
  ];

  return (
    <header className="bg-card rounded-xl border border-border overflow-hidden mb-4 md:mb-6 animate-fade-in">
      {/* Desktop Layout */}
      <div className="hidden md:block p-5">
        {/* Row 1: Logo + Project + Quick Links */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <img 
              src={bwildLogo} 
              alt="Bwild" 
              className="h-8 w-auto"
            />
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-lg font-semibold text-foreground leading-tight">
                {projectName} – {unitName}
              </h1>
              {clientName && (
                <p className="text-sm text-foreground/70">
                  {clientName}
                </p>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-1">
            {quickLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Row 2: Team contacts */}
        <div className="flex items-center gap-8 mb-4 pb-4 border-b border-border">
          {teamContacts.map((contact) => (
            <div key={contact.role} className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent">
                <User className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <span className="font-medium text-foreground">{contact.role}:</span>{" "}
                <span className="text-foreground/70">{contact.name}</span>
              </div>
              <a 
                href={`tel:+55${contact.phone.replace(/\D/g, '')}`} 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{contact.phone}</span>
              </a>
            </div>
          ))}
        </div>

        {/* Row 3: Date Metrics */}
        <div className="flex items-center gap-6 text-sm">
          {dateMetrics.map((metric) => (
            <span key={metric.label}>
              <span className="font-medium text-foreground">{metric.label}:</span>{" "}
              <span className="text-foreground/70">{metric.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Tablet Layout (sm to md) */}
      <div className="hidden sm:block md:hidden p-4">
        {/* Row 1: Logo + Project */}
        <div className="flex items-center gap-3 mb-4">
          <img 
            src={bwildLogo} 
            alt="Bwild" 
            className="h-7 w-auto"
          />
          <div className="h-5 w-px bg-border" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-foreground leading-tight truncate">
              {projectName} – {unitName}
            </h1>
            {clientName && (
              <p className="text-sm text-foreground/70 truncate">{clientName}</p>
            )}
          </div>
        </div>

        {/* Quick Links - Horizontal scroll */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-muted-foreground bg-muted/50 hover:bg-accent hover:text-foreground active:scale-95 transition-all whitespace-nowrap"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </a>
          ))}
        </div>

        {/* Team contacts - Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-border">
          {teamContacts.map((contact) => (
            <a
              key={contact.role}
              href={`tel:+55${contact.phone.replace(/\D/g, '')}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-accent/50 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent shrink-0">
                <User className="w-5 h-5 text-accent-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground/70">{contact.role}</p>
                <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {contact.phone}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* Date Metrics - Horizontal */}
        <div className="flex items-center justify-between text-sm">
          {dateMetrics.map((metric) => (
            <div key={metric.label} className="text-center">
              <p className="text-xs font-medium text-foreground/50 mb-0.5">{metric.label}</p>
              <p className="font-medium text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Layout (< sm) */}
      <div className="sm:hidden p-3">
        {/* Row 1: Logo + Project info */}
        <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-border">
          <img 
            src={bwildLogo} 
            alt="Bwild" 
            className="h-6 w-auto shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground leading-tight truncate">
              {projectName} – {unitName}
            </h1>
            {clientName && (
              <p className="text-xs text-foreground/70">{clientName}</p>
            )}
          </div>
        </div>

        {/* Row 2: Quick Links - Icon grid */}
        <div className="grid grid-cols-5 gap-1 mb-3 pb-3 border-b border-border">
          {quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 active:scale-95 transition-all min-h-[56px]"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/60">
                <link.icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-medium leading-tight text-center">{link.label}</span>
            </a>
          ))}
        </div>

        {/* Row 3: Dates - Compact horizontal */}
        <div className="flex items-center justify-between text-xs mb-3 pb-3 border-b border-border">
          {dateMetrics.map((metric, index) => (
            <div key={metric.label} className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
              <div>
                <span className="text-foreground/60">{metric.label}: </span>
                <span className="font-medium text-foreground">{metric.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Row 4: Team contacts - Full width cards */}
        <div className="space-y-2">
          {teamContacts.map((contact) => (
            <a
              key={contact.role}
              href={`tel:+55${contact.phone.replace(/\D/g, '')}`}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 active:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-accent shrink-0">
                <User className="w-4 h-4 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-foreground/60">{contact.role}</p>
                <p className="text-sm font-medium text-foreground">{contact.name}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary shrink-0">
                <Phone className="w-3.5 h-3.5" />
                <span>Ligar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </header>
  );
};

export default ReportHeader;
