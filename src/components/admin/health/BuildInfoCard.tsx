import { Server, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getBuildInfo, getShortCommit } from "@/lib/buildInfo";

export const BuildInfoCard = () => {
  const buildInfo = getBuildInfo();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">Build Info</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(
                `${buildInfo.commit} | ${buildInfo.environment} | ${buildInfo.version}`,
              );
              toast({ title: "Copiado!" });
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Commit</p>
            <p className="font-mono font-medium">{getShortCommit()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Branch</p>
            <p className="font-medium">{buildInfo.branch}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ambiente</p>
            <Badge
              variant={
                buildInfo.environment === "production"
                  ? "destructive"
                  : "secondary"
              }
            >
              {buildInfo.environment}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Versão</p>
            <p className="font-medium">{buildInfo.version}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
