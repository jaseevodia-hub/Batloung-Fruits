import { useMemo, useState } from "react";

export default function useTableFilter(rows) {
  const [filterKey, setFilterKey] = useState("");
  const [filterValue, setFilterValue] = useState("");

  const filteredRows = useMemo(() => {
    const values = Array.isArray(rows) ? rows : [];

    if (!filterKey || filterValue === "") return values;

    return values.filter(
      (row) =>
        String(row[filterKey] ?? "").toLowerCase() === filterValue.toLowerCase()
    );
  }, [rows, filterKey, filterValue]);

  function changeFilter(key, value) {
    setFilterKey(key);
    setFilterValue(value);
  }

  function clearFilter() {
    setFilterKey("");
    setFilterValue("");
  }

  return { filterKey, filterValue, filteredRows, changeFilter, clearFilter };
}
