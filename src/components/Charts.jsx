export function TrendChart({ data, formatValue = (value) => value }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const peakValue = Math.max(...data.map((item) => item.value), 0);

  return (
    <div className="trend-chart" role="img" aria-label="Revenue trend chart">
      {data.map((item) => {
        const height = Math.max(
          (item.value / max) * 100,
          item.value > 0 ? 4 : 1.5
        );
        const isPeak = item.value > 0 && item.value === peakValue;

        return (
          <div
            className="trend-bar"
            key={item.key || item.label}
            title={`${item.label}: ${formatValue(item.value)}`}
          >
            <div className="trend-bar-track">
              <div
                className={`trend-bar-fill${isPeak ? " is-peak" : ""}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="trend-bar-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({ data, total, centerLabel = "Orders" }) {
  const safeTotal = data.reduce((sum, item) => sum + item.value, 0);
  const displayTotal = total ?? safeTotal;

  const visible = data.filter((item) => item.value > 0);
  const segments = visible.map((item, index) => {
    const start =
      (visible
        .slice(0, index)
        .reduce((sum, previous) => sum + previous.value, 0) /
        safeTotal) *
      360;
    const end = start + (item.value / safeTotal) * 360;

    return `${item.color} ${start}deg ${end}deg`;
  });

  const background = segments.length
    ? `conic-gradient(${segments.join(", ")})`
    : "conic-gradient(#e7eee9 0deg 360deg)";

  return (
    <div className="donut-layout">
      <div className="donut" style={{ background }}>
        <div className="donut-center">
          <strong>{displayTotal}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>

      <ul className="donut-legend">
        {data.map((item) => (
          <li key={item.label}>
            <span
              className="donut-dot"
              style={{ background: item.color }}
            />
            <span>{item.label}</span>
            <span className="donut-value">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarList({
  items,
  formatValue = (value) => value,
  emptyMessage = "No data for this period.",
}) {
  if (!items.length) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="bar-list">
      {items.map((item) => (
        <div
          className="bar-list-item"
          key={item.label}
          title={`${item.label}: ${formatValue(item.value)}`}
        >
          <div className="bar-list-head">
            <span>{item.label}</span>
            <strong>{formatValue(item.value)}</strong>
          </div>
          <div className="bar-list-track">
            <div
              className="bar-list-fill"
              style={{
                width: `${Math.max(
                  (item.value / max) * 100,
                  item.value > 0 ? 2 : 0
                )}%`,
                background: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
