import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText } from "lucide-react";
import ReportHeader from "@/components/ReportHeader";
import SCurveChart from "@/components/SCurveChart";
import ScheduleTable from "@/components/ScheduleTable";
import TechnicalReport from "@/components/TechnicalReport";

const Index = () => {
  const [activeTab, setActiveTab] = useState("curvaS");

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <ReportHeader
          projectName="Condomínio MY ONE BROOKLIN"
          unitName="Unidade 502"
          clientName="Carlos Ney Kailer Costa"
          startDate="27/10/2025"
          endDate="19/01/2026"
          completedActivities={4}
          totalActivities={16}
          startedActivities={7}
        />

        <div className="bg-card rounded-xl shadow-card overflow-hidden animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b-2 border-border px-4 md:px-6">
              <TabsList className="bg-transparent h-auto p-0 gap-0">
                <TabsTrigger
                  value="curvaS"
                  className="data-[state=active]:bg-accent data-[state=active]:text-primary data-[state=active]:border-b-4 data-[state=active]:border-primary data-[state=inactive]:border-b-4 data-[state=inactive]:border-transparent rounded-none px-4 md:px-8 py-4 font-bold text-sm md:text-base transition-all"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Curva S
                </TabsTrigger>
                <TabsTrigger
                  value="relatorio"
                  className="data-[state=active]:bg-accent data-[state=active]:text-primary data-[state=active]:border-b-4 data-[state=active]:border-primary data-[state=inactive]:border-b-4 data-[state=inactive]:border-transparent rounded-none px-4 md:px-8 py-4 font-bold text-sm md:text-base transition-all"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Relatório Técnico
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4 md:p-8">
              <TabsContent value="curvaS" className="mt-0">
                <SCurveChart />
                <ScheduleTable />
              </TabsContent>

              <TabsContent value="relatorio" className="mt-0">
                <TechnicalReport />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
