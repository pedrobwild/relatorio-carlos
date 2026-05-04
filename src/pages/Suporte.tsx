import {
  ArrowLeft,
  FileText,
  Plus,
  Filter,
  Search,
  FileSignature,
  ChevronRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import {
  FormalizationStatus,
  FormalizationType,
  FORMALIZATION_TYPE_LABELS,
  FORMALIZATION_STATUS_LABELS,
} from "@/types/formalization";
import {
  getStatusIcon,
  getStatusBadgeVariant,
  getTypeIcon,
  formatFormalizationDate as formatDate,
} from "@/lib/formalizationHelpers";

// Mock data for demonstration
const mockFormalizations = [
  {
    id: "1",
    type: "budget_item_swap" as FormalizationType,
    title: "Troca de revestimento do banheiro",
    summary: "Substituição do porcelanato Portinari por Eliane na suíte master",
    status: "signed" as FormalizationStatus,
    created_at: "2025-09-01T10:00:00Z",
    locked_at: "2025-09-03T14:30:00Z",
    parties_signed: 2,
    parties_total: 2,
  },
  {
    id: "2",
    type: "meeting_minutes" as FormalizationType,
    title: "Reunião de alinhamento - Semana 8",
    summary: "Definições sobre acabamentos e cronograma de entrega",
    status: "pending_signatures" as FormalizationStatus,
    created_at: "2025-09-05T09:00:00Z",
    locked_at: null,
    parties_signed: 1,
    parties_total: 2,
  },
  {
    id: "3",
    type: "exception_custody" as FormalizationType,
    title: "Custódia - Geladeira Samsung",
    summary: "Recebimento e custódia do eletrodoméstico até instalação",
    status: "draft" as FormalizationStatus,
    created_at: "2025-09-08T11:00:00Z",
    locked_at: null,
    parties_signed: 0,
    parties_total: 2,
  },
];

const Suporte = () => {
  const signedCount = mockFormalizations.filter(
    (f) => f.status === "signed",
  ).length;
  const pendingCount = mockFormalizations.filter(
    (f) => f.status === "pending_signatures",
  ).length;
  const draftCount = mockFormalizations.filter(
    (f) => f.status === "draft",
  ).length;

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/relatorio">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-11 w-11 rounded-full hover:bg-primary/10"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <img src={bwildLogo} alt="Bwild" className="h-8 w-auto" />
              <span className="text-muted-foreground/40">|</span>
              <h1 className="text-h2">Formalizações</h1>
            </div>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Formalização</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-[hsl(var(--success-light))] border-[hsl(var(--success)/0.3)]">
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />
                  <span className="text-2xl font-bold text-[hsl(var(--success))]">
                    {signedCount}
                  </span>
                </div>
                <span className="text-caption mt-1">Assinadas</span>
              </CardContent>
            </Card>
            <Card className="bg-[hsl(var(--warning-light))] border-[hsl(var(--warning)/0.3)]">
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[hsl(var(--warning))]" />
                  <span className="text-2xl font-bold text-[hsl(var(--warning))]">
                    {pendingCount}
                  </span>
                </div>
                <span className="text-caption mt-1">Pendentes</span>
              </CardContent>
            </Card>
            <Card className="bg-muted/50 border-border">
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">
                    {draftCount}
                  </span>
                </div>
                <span className="text-caption mt-1">Rascunhos</span>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar formalizações..."
                className="pl-9 h-11"
              />
            </div>
            <Button variant="outline" size="icon" className="h-11 w-11">
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="signed">Assinadas</TabsTrigger>
              <TabsTrigger value="draft">Rascunhos</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4 space-y-3">
              {mockFormalizations.map((formalization) => (
                <Card
                  key={formalization.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">
                        {getTypeIcon(formalization.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-body font-medium truncate">
                              {formalization.title}
                            </h3>
                            <p className="text-caption line-clamp-1 mt-0.5">
                              {formalization.summary}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge
                            variant={getStatusBadgeVariant(
                              formalization.status,
                            )}
                            className="gap-1"
                          >
                            {getStatusIcon(formalization.status)}
                            <span>
                              {
                                FORMALIZATION_STATUS_LABELS[
                                  formalization.status
                                ]
                              }
                            </span>
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {FORMALIZATION_TYPE_LABELS[formalization.type]}
                          </Badge>
                          <span className="text-tiny">
                            {formatDate(formalization.created_at)}
                          </span>
                          {formalization.status !== "draft" && (
                            <span className="text-tiny flex items-center gap-1">
                              <FileSignature className="w-3 h-3" />
                              {formalization.parties_signed}/
                              {formalization.parties_total}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="pending" className="mt-4 space-y-3">
              {mockFormalizations
                .filter((f) => f.status === "pending_signatures")
                .map((formalization) => (
                  <Card
                    key={formalization.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">
                          {getTypeIcon(formalization.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-body font-medium truncate">
                                {formalization.title}
                              </h3>
                              <p className="text-caption line-clamp-1 mt-0.5">
                                {formalization.summary}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge
                              variant={getStatusBadgeVariant(
                                formalization.status,
                              )}
                              className="gap-1"
                            >
                              {getStatusIcon(formalization.status)}
                              <span>
                                {
                                  FORMALIZATION_STATUS_LABELS[
                                    formalization.status
                                  ]
                                }
                              </span>
                            </Badge>
                            <span className="text-tiny flex items-center gap-1">
                              <FileSignature className="w-3 h-3" />
                              {formalization.parties_signed}/
                              {formalization.parties_total}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>

            <TabsContent value="signed" className="mt-4 space-y-3">
              {mockFormalizations
                .filter((f) => f.status === "signed")
                .map((formalization) => (
                  <Card
                    key={formalization.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">
                          {getTypeIcon(formalization.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-body font-medium truncate">
                                {formalization.title}
                              </h3>
                              <p className="text-caption line-clamp-1 mt-0.5">
                                {formalization.summary}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge
                              variant={getStatusBadgeVariant(
                                formalization.status,
                              )}
                              className="gap-1"
                            >
                              {getStatusIcon(formalization.status)}
                              <span>
                                {
                                  FORMALIZATION_STATUS_LABELS[
                                    formalization.status
                                  ]
                                }
                              </span>
                            </Badge>
                            <span className="text-tiny">
                              Assinado em {formatDate(formalization.locked_at!)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>

            <TabsContent value="draft" className="mt-4 space-y-3">
              {mockFormalizations
                .filter((f) => f.status === "draft")
                .map((formalization) => (
                  <Card
                    key={formalization.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">
                          {getTypeIcon(formalization.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-body font-medium truncate">
                                {formalization.title}
                              </h3>
                              <p className="text-caption line-clamp-1 mt-0.5">
                                {formalization.summary}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge
                              variant={getStatusBadgeVariant(
                                formalization.status,
                              )}
                              className="gap-1"
                            >
                              {getStatusIcon(formalization.status)}
                              <span>
                                {
                                  FORMALIZATION_STATUS_LABELS[
                                    formalization.status
                                  ]
                                }
                              </span>
                            </Badge>
                            <span className="text-tiny">
                              Criado em {formatDate(formalization.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>
          </Tabs>

          {/* Info Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-h3 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-primary" />
                Sobre Formalizações
              </CardTitle>
            </CardHeader>
            <CardContent className="text-body text-muted-foreground space-y-2">
              <p>
                Formalizações são documentos que registram acordos, atas de
                reunião e alterações de escopo com comprovação de ciência de
                ambas as partes.
              </p>
              <p>
                Após a assinatura de todas as partes, o documento é bloqueado e
                recebe um hash de integridade para garantir que não foi
                alterado.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Suporte;
