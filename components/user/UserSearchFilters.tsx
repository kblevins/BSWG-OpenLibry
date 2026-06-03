import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AlertTriangle, Filter, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

interface UserSearchFiltersProps {
  onFilterChange: (filterString: string) => void;
}

export default function UserSearchFilters({
  onFilterChange,
}: UserSearchFiltersProps) {
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    // NOTE: "fällig?" is NOT a display string — it is a filter-query token
    // parsed by filterUsers(). Do not translate it.
    onFilterChange(isOverdue ? "fällig?" : "");
  }, [isOverdue, onFilterChange]);

  const handleReset = () => {
    setIsOverdue(false);
  };

  const hasActiveFilters = isOverdue;

  return (
    <TooltipProvider delayDuration={300}>
      <div>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-primary" />
            <span className="text-sm font-semibold text-primary">
              {t("userSearchFilters.filter")}
            </span>
            {hasActiveFilters && (
              <Badge
                variant="secondary"
                className="h-[18px] bg-primary/15 px-1.5 text-[0.65rem] text-primary"
              >
                {t("userSearchFilters.active")}
              </Badge>
            )}
          </div>

          {hasActiveFilters && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-6 gap-1.5 px-2 text-xs text-muted-foreground"
                >
                  <RotateCcw size={12} />
                  {t("userSearchFilters.reset")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("userSearchFilters.resetTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Filter Options */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Overdue Toggle */}
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t("userSearchFilters.status")}
            </label>
            <Toggle
              pressed={isOverdue}
              onPressedChange={setIsOverdue}
              className={cn(
                "h-auto w-full justify-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                "data-[state=off]:bg-transparent data-[state=off]:border-primary/20 data-[state=off]:text-muted-foreground",
                "data-[state=on]:bg-warning/10 data-[state=on]:border-warning data-[state=on]:text-warning",
              )}
            >
              <AlertTriangle size={16} />
              {t("userSearchFilters.onlyOverdue")}
            </Toggle>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {isOverdue && (
              <Badge
                variant="secondary"
                className="gap-1 bg-warning/10 pr-1 text-warning"
              >
                {t("userSearchFilters.overdueChip")}
                <button
                  type="button"
                  onClick={() => setIsOverdue(false)}
                  className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10"
                >
                  <X size={12} />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
