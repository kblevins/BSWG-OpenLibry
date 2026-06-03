import { t } from "@/lib/i18n";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type UserLabelsCardProps = {
  title: string;
  subtitle: string;
  link: string;
  startLabel: number;
  setStartLabel: (value: number) => void;
  totalNumber: number;
  startUserId: number;
  setStartUserId: (value: number) => void;
  endUserId: number;
  setEndUserId: (value: number) => void;
  idUserFilter: number;
  setIdUserFilter: (value: number) => void;
};

export default function UserLabelsCard({
  title,
  subtitle,
  link,
  startLabel,
  totalNumber,
  setStartLabel,
  idUserFilter,
  setIdUserFilter,
  startUserId,
  setStartUserId,
  endUserId,
  setEndUserId,
}: UserLabelsCardProps) {
  const getUserUrl = () => {
    return (
      "/?" +
      (startLabel > 0 ? "start=0" + "&end=" + Math.floor(startLabel) : "") +
      (startUserId > 0 || endUserId > 0
        ? "&startId=" + startUserId + "&endId=" + endUserId
        : "") +
      (idUserFilter > 0 ? "&id=" + idUserFilter : "")
    );
  };

  return (
    <Card
      className="overflow-hidden border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.10),0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200"
      data-cy="user-labels-card"
    >
      {/* Accent bar — secondary */}
      <div className="h-1 w-full bg-gradient-to-r from-secondary to-secondary/50" />

      <CardHeader className="pb-2">
        <CardTitle
          className="text-lg text-muted-foreground"
          data-cy="user-labels-title"
        >
          {title}
        </CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Count */}
        <div className="space-y-1.5">
          <Label htmlFor="user-label-count">
            {t("userLabelsCard.countLabel")}
          </Label>
          <Input
            id="user-label-count"
            type="number"
            value={startLabel}
            onChange={(e) => setStartLabel(parseInt(e.target.value))}
            className={
              startLabel > totalNumber
                ? "border-destructive focus-visible:ring-destructive/20"
                : ""
            }
            data-cy="user-labels-count-input"
          />
          {startLabel > totalNumber && (
            <p className="text-xs text-destructive">
              {t("userLabelsCard.countTooMany")}
            </p>
          )}
        </div>

        <Separator />

        {/* ID Range */}
        <p className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
          {t("userLabelsCard.idRangeHeading")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="idUserRangeFrom">
              {t("userLabelsCard.fromId")}
            </Label>
            <Input
              id="idUserRangeFrom"
              type="number"
              value={startUserId}
              onChange={(e) => setStartUserId(parseInt(e.target.value))}
              data-cy="user-labels-start-id"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idUserRangeTo">{t("userLabelsCard.toId")}</Label>
            <Input
              id="idUserRangeTo"
              type="number"
              value={endUserId}
              onChange={(e) => setEndUserId(parseInt(e.target.value))}
              data-cy="user-labels-end-id"
            />
          </div>
        </div>

        <Separator />

        {/* Filters */}
        <p className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
          {t("userLabelsCard.filtersHeading")}
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="user-label-single-id">
            {t("userLabelsCard.singleIdLabel")}
          </Label>
          <Input
            id="user-label-single-id"
            type="number"
            value={idUserFilter}
            onChange={(e) => setIdUserFilter(parseInt(e.target.value))}
            data-cy="user-labels-user-id-filter"
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(link + getUserUrl(), "_blank")}
          className="text-primary hover:bg-primary/5 font-semibold"
          data-cy="user-labels-generate-button"
        >
          {t("userLabelsCard.generatePdf")}
        </Button>
      </CardFooter>
    </Card>
  );
}
