import { useState } from "react";
import { Link } from "react-router-dom";
import bwildLogo from "@/assets/bwild-logo.png";
import { FileText, Box, Ruler, DollarSign, Headphones, User, Phone, Mail, ChevronDown } from "lucide-react";
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

interface TeamContact {
  role: string;
  name: string;
  phone: string;
  email: string;
  crea?: string;
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
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  const quickLinks = [
    { icon: FileText, label: "Contrato", href: "/contrato" },
    { icon: Box, label: "Projeto 3D", href: "/projeto-3d" },
    { icon: Ruler, label: "Executivo", href: "/executivo" },
    { icon: DollarSign, label: "Financeiro", href: "/financeiro" },
    { icon: Headphones, label: "Suporte", href: "/suporte" },
  ];

  const teamContacts: TeamContact[] = [
    { role: "Engenheiro", name: "Lucas Tresmondi", phone: "(99) 99999-9999", email: "lucas@bwild.com.br", crea: "5071459470-SP" },
    { role: "Gerente de Relacionamento", name: "Victorya Capponi", phone: "(99) 99999-9999", email: "victorya@bwild.com.br" },
  ];

  const toggleContact = (role: string) => {
    setExpandedContact(expandedContact === role ? null : role);
  };

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
          <div className="flex items-center gap-1.5">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-medium text-foreground/80 hover:text-foreground hover:bg-accent transition-colors"
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Row 2: Team contacts */}
        <div className="flex items-center gap-8 mb-4 pb-4 border-b border-border">
          {teamContacts.map((contact) => (
            <div key={contact.role} className="relative">
              <button
                onClick={() => toggleContact(contact.role)}
                className="flex items-center gap-3 text-sm hover:bg-accent/50 p-2 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent">
                  <User className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <span className="font-medium text-foreground">{contact.role}:</span>{" "}
                  <span className="text-foreground/70">{contact.name}</span>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-muted-foreground">
                  <span className="text-sm">Contato</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedContact === contact.role ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {/* Expanded contact details */}
              {expandedContact === contact.role && (
                <div className="absolute top-full left-0 mt-1 z-10 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[240px] animate-fade-in">
                  <div className="space-y-2">
                    <a 
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{contact.email}</span>
                    </a>
                    <a 
                      href={`tel:+55${contact.phone.replace(/\D/g, '')}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{contact.phone}</span>
                    </a>
                    {contact.crea && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1 border-t border-border">
                        <span className="font-medium">CREA:</span>
                        <span>{contact.crea}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
            <Link
              key={link.label}
              to={link.href}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-foreground/80 bg-muted/50 hover:bg-accent hover:text-foreground active:scale-95 transition-all whitespace-nowrap"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Team contacts - Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-border">
          {teamContacts.map((contact) => (
            <div key={contact.role} className="relative">
              <button
                onClick={() => toggleContact(contact.role)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-accent/50 active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent shrink-0">
                  <User className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground/70">{contact.role}</p>
                  <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                  <span className="text-[10px] font-semibold">Contato</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedContact === contact.role ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {/* Expanded contact details */}
              {expandedContact === contact.role && (
                <div className="mt-2 bg-card border border-border rounded-lg p-3 animate-fade-in">
                  <div className="space-y-2">
                    <a 
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{contact.email}</span>
                    </a>
                    <a 
                      href={`tel:+55${contact.phone.replace(/\D/g, '')}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{contact.phone}</span>
                    </a>
                    {contact.crea && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1 border-t border-border">
                        <span className="font-medium">CREA:</span>
                        <span>{contact.crea}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
        {/* Row 1: Project info - Primary hierarchy */}
        <div className="mb-3 pb-3 border-b border-border">
          <p className="text-[10px] font-medium text-primary/80 uppercase tracking-wider mb-0.5">Projeto</p>
          <h1 className="text-base font-bold text-foreground leading-tight">
            {projectName} – {unitName}
          </h1>
          {clientName && (
            <p className="text-xs text-muted-foreground mt-0.5">Cliente: <span className="text-foreground/80">{clientName}</span></p>
          )}
        </div>

        {/* Row 2: Quick Links - Icon grid */}
        <div className="mb-3 pb-3 border-b border-border">
          <p className="text-[11px] font-bold text-foreground uppercase tracking-wider mb-2">Menu de Acesso</p>
          <div className="grid grid-cols-5 gap-1">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="flex flex-col items-center justify-center gap-1.5 py-2 rounded-lg text-foreground/80 hover:text-primary hover:bg-primary/5 active:scale-95 transition-all min-h-[56px]"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                  <link.icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-medium leading-tight text-center">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Row 3: Dates - Secondary hierarchy */}
        <div className="mb-3 pb-3 border-b border-border">
          <p className="text-[11px] font-bold text-foreground uppercase tracking-wider mb-2">Cronograma</p>
          <div className="grid grid-cols-3 gap-2">
            {dateMetrics.map((metric) => (
              <div key={metric.label} className="bg-muted/30 rounded-lg px-2 py-1.5 text-center">
                <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">{metric.label}</p>
                <p className="text-[11px] font-medium text-foreground">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Row 4: Team contacts - Tertiary hierarchy */}
        <div>
          <p className="text-[11px] font-bold text-foreground uppercase tracking-wider mb-2">Equipe</p>
          <div className="space-y-1.5">
            {teamContacts.map((contact) => (
              <div key={contact.role}>
                <button
                  onClick={() => toggleContact(contact.role)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-muted/40 hover:bg-accent/60 active:scale-[0.98] transition-all text-left"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-medium text-primary/70 uppercase tracking-wide">{contact.role}</p>
                    <p className="text-xs font-semibold text-foreground">{contact.name}</p>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                    <span className="text-[10px] font-semibold">Contato</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedContact === contact.role ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                
                {/* Expanded contact details */}
                {expandedContact === contact.role && (
                  <div className="mt-1.5 ml-10.5 bg-card border border-border rounded-lg p-2.5 animate-fade-in">
                    <div className="space-y-1.5">
                      <a 
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{contact.email}</span>
                      </a>
                      <a 
                        href={`tel:+55${contact.phone.replace(/\D/g, '')}`}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{contact.phone}</span>
                      </a>
                      {contact.crea && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                          <span className="font-medium">CREA:</span>
                          <span>{contact.crea}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ReportHeader;
