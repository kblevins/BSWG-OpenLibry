import { useState } from "react";

export function useUserLabelFilters() {
  const [startLabel, setStartLabel] = useState(0);
  const [startUserId, setStartUserId] = useState(0);
  const [endUserId, setEndUserId] = useState(0);
  const [idUserFilter, setIdUserFilter] = useState(0);

  return {
    startLabel,
    setStartLabel,
    startUserId,
    setStartUserId,
    endUserId,
    setEndUserId,
    idUserFilter,
    setIdUserFilter,
  };
}
