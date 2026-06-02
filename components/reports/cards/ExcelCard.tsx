import { t } from "@/lib/i18n";
import { Download } from "lucide-react";

interface ExcelCardProps {
  dataCy?: string;
}

export default function ExcelCard({ dataCy = "excel-card" }: ExcelCardProps) {
  return (
    <div
      className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 flex flex-col gap-4"
      data-cy={dataCy}
    >
      <div>
        <h3 className="text-base font-semibold leading-none tracking-tight">
          {t("excelCard.title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1.5">
          {t("excelCard.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        <a
          href="api/excel"
          data-cy="excel-export-button"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Download size={15} />
          {t("excelCard.exportButton")}
        </a>
      </div>
    </div>
  );
}
