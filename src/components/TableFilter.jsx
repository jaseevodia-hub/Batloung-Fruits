import { useMemo } from "react";

export function TableFilter({
  columns,
  rows,
  filterKey,
  filterValue,
  onChange,
  onClear,
}) {
  const values = useMemo(() => {
    if (!filterKey) return [];

    const seen = new Set();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const value = row[filterKey];
      if (value !== undefined && value !== null && value !== "") {
        seen.add(String(value));
      }
    });

    return Array.from(seen).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [rows, filterKey]);

  return (
    <div className="table-filter" role="group" aria-label="Filter table">
      <select
        className="table-filter-column"
        value={filterKey}
        onChange={(event) => onChange(event.target.value, "")}
        aria-label="Filter by column"
      >
        <option value="">Filter by...</option>
        {columns.map((column) => (
          <option key={column.key} value={column.key}>
            {column.label}
          </option>
        ))}
      </select>

      <select
        className="table-filter-value"
        value={filterValue}
        onChange={(event) => onChange(filterKey, event.target.value)}
        disabled={!filterKey}
        aria-label="Filter value"
      >
        <option value="">All</option>
        {values.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      {(filterKey || filterValue) && (
        <button type="button" className="table-filter-clear" onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  );
}

export default TableFilter;
