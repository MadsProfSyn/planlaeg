import { Button } from "@/components/ui/button";
import { Plus, Minus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  className?: string;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onResetView,
  className,
}: MapControlsProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border p-1",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomIn}
        className="h-8 w-8"
        title="Zoom ind"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomOut}
        className="h-8 w-8"
        title="Zoom ud"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <div className="h-px bg-border my-0.5" />
      <Button
        variant="ghost"
        size="icon"
        onClick={onResetView}
        className="h-8 w-8"
        title="Nulstil visning"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
