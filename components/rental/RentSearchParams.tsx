import React, { useEffect } from "react";

import { t } from "@/lib/i18n";

interface RentSearchParamsType {
  overdue: boolean;
  setUserSearchInput: (value: string) => void;
}

export default function RentSearchParams({
  overdue,
  setUserSearchInput,
}: RentSearchParamsType) {
  const [isOverdue, setIsOverdue] = React.useState(overdue);

  useEffect(() => {
    setUserSearchInput(isOverdue ? "fällig? " : " ");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setState is stable
  }, [isOverdue]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-row items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            checked={isOverdue}
            onChange={(e) => setIsOverdue(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary
                       focus:ring-2 focus:ring-primary/20 focus:ring-offset-0"
          />
          {t("rentSearchParams.overdue")}
        </label>
      </div>
    </div>
  );
}
