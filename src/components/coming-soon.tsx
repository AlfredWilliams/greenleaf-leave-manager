import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({ title, description, phase }: { title: string; description: string; phase: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <Badge variant="secondary" className="mb-3">{phase}</Badge>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
