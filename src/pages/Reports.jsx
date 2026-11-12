import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import useTableFilter from "../hooks/useTableFilter";
import { TableFilter } from "../components/TableFilter";
import Modal from "../components/Modal";
import { BarList, DonutChart, TrendChart } from "../components/Charts";

const API = "http://localhost:5001/api";

const CHART_COLORS = [
  "#22855b",
  "#f0a31a",
  "#2158a5",
  "#663bb1",
  "#b42318",
  "#0f766e",
  "#8a6100",
  "#475a50",
];

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const statusFilterColumns = [
  { key: "label", label: "Status" },
];

const popularFilterColumns = [
  { key: "fruit", label: "Fruit" },
  { key: "size", label: "Box Size" },
];

const completedFilterColumns = [
  { key: "order_number", label: "Order Number" },
  { key: "vendor_name", label: "Vendor" },
];

const stockReportFilterColumns = [
  { key: "fruit", label: "Fruit" },
  { key: "box_size", label: "Box Size" },
  { key: "status", label: "Status" },
];

const purchaseReportFilterColumns = [
  { key: "supplier_name", label: "Supplier" },
  { key: "fruit", label: "Fruit" },
  { key: "box_size", label: "Box Size" },
];

const REPORT_META = {
  status: {
    title: "Order Status Summary",
    subtitle: "Number of orders in each status for the selected period.",
  },
  popular: {
    title: "Popular Fruits",
    subtitle: "Fruit products ranked by boxes ordered.",
  },
  completed: {
    title: "Completed Orders Sales",
    subtitle: "Completed orders and their sales value.",
  },
  stock: {
    title: "Stock Report",
    subtitle: "Current stock levels, pricing, and stock value.",
  },
  purchases: {
    title: "Purchases Report",
    subtitle: "Supplier purchases and spending for the selected period.",
  },
};

function ReportIcon({ type }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (type) {
    case "status":
      return (
        <svg {...props}>
          <path d="M4 6h16M4 12h16M4 18h10" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      );
    case "popular":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4c2 3 2 13 0 16M4 12c3-2 13-2 16 0" />
        </svg>
      );
    case "completed":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
      );
    case "stock":
      return (
        <svg {...props}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
          <path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6" />
        </svg>
      );
  }
}

function Reports() {
  const [orders, setOrders] = useState([]);
  const [fruitStats, setFruitStats] = useState([]);
  const [orderStatuses, setOrderStatuses] = useState([]);
  const [stock, setStock] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [period, setPeriod] = useState("all");
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      setError("");

      try {
        const statusesResponse = await apiFetch(`${API}/order-statuses`);
        if (statusesResponse.ok) {
          const statusesData = await statusesResponse.json();
          setOrderStatuses(
            Array.isArray(statusesData) ? statusesData : []
          );
        }

        const stockResponse = await apiFetch(`${API}/stock`);
        if (stockResponse.ok) {
          const stockData = await stockResponse.json();
          setStock(Array.isArray(stockData) ? stockData : []);
        }

        const purchaseResponse = await apiFetch(`${API}/purchases`);
        if (purchaseResponse.ok) {
          const purchaseData = await purchaseResponse.json();
          setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
        }

        const response = await apiFetch(`${API}/orders`);
        if (!response.ok) throw new Error("Could not load orders.");

        const data = await response.json();
        setOrders(data);

        const details = await Promise.all(
          data.map(async (order) => {
            try {
              const result = await apiFetch(`${API}/orders/${order.id}`);
              if (!result.ok) return null;
              return await result.json();
            } catch {
              return null;
            }
          })
        );

        const map = {};

        details.forEach((order) => {
          if (!order || order.status === "cancelled") return;

          (order.items || []).forEach((item) => {
            const fruit = item.fruit || item.fruit_name || "Unknown fruit";
            const size = item.size || item.size_name || "";
            const key = `${fruit}__${size}`;

            if (!map[key]) {
              map[key] = { fruit, size, boxes: 0, sales: 0 };
            }

            map[key].boxes += Number(item.quantity_boxes) || 0;

            if (order.status === "completed") {
              map[key].sales += Number(item.subtotal) || 0;
            }
          });
        });

        setFruitStats(Object.values(map));
      } catch (err) {
        setError(err.message || "Could not load reports.");
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  const filteredOrders = useMemo(() => {
    const now = new Date();

    return orders.filter((order) => {
      if (period === "all") return true;

      const date = new Date(order.order_date);
      if (Number.isNaN(date.getTime())) return false;

      if (period === "today") {
        return date.toDateString() === now.toDateString();
      }

      const days = Number(period);
      const start = new Date(now);
      start.setDate(now.getDate() - days + 1);
      start.setHours(0, 0, 0, 0);

      return date >= start && date <= now;
    });
  }, [orders, period]);

  const completed = filteredOrders.filter(
    (order) => order.status === "completed"
  );
  const pending = filteredOrders.filter(
    (order) => order.status === "pending"
  );
  const cancelled = filteredOrders.filter(
    (order) => order.status === "cancelled"
  );

  const revenue = completed.reduce(
    (sum, order) => sum + (Number(order.total_amount) || 0),
    0
  );

  const money = (amount) =>
    `M ${Number(amount || 0).toLocaleString("en-LS", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const popular = useMemo(() => {
    return fruitStats
      .map((fruit) => ({ ...fruit }))
      .sort((a, b) => b.boxes - a.boxes);
  }, [fruitStats]);

  const totalStockBoxes = stock.reduce(
    (sum, product) => sum + (Number(product.quantity_available) || 0),
    0
  );

  const filteredPurchases = useMemo(() => {
    const now = new Date();

    return purchases.filter((purchase) => {
      if (period === "all") return true;

      const date = new Date(purchase.purchase_date);
      if (Number.isNaN(date.getTime())) return false;

      if (period === "today") {
        return date.toDateString() === now.toDateString();
      }

      const days = Number(period);
      const start = new Date(now);
      start.setDate(now.getDate() - days + 1);
      start.setHours(0, 0, 0, 0);

      return date >= start && date <= now;
    });
  }, [purchases, period]);

  const purchaseSpend = filteredPurchases.reduce(
    (sum, purchase) => sum + (Number(purchase.total_cost) || 0),
    0
  );

  const trendDays =
    period === "30" ? 30 : period === "7" ? 7 : period === "today" ? 7 : 14;

  const revenueTrend = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets = [];

    for (let index = trendDays - 1; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);

      buckets.push({
        key: dayKey(date),
        label: date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        value: 0,
      });
    }

    const byDay = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    filteredOrders.forEach((order) => {
      if (order.status !== "completed") return;

      const date = new Date(order.order_date);
      if (Number.isNaN(date.getTime())) return;

      const bucket = byDay.get(dayKey(date));
      if (bucket) {
        bucket.value += Number(order.total_amount) || 0;
      }
    });

    return buckets;
  }, [filteredOrders, trendDays]);

  const statusChartData = useMemo(() => {
    const source = orderStatuses.length
      ? orderStatuses
      : Array.from(new Set(filteredOrders.map((order) => order.status))).map(
          (code) => ({ code, label: code })
        );

    return source.map((status, index) => ({
      label: status.label,
      value: filteredOrders.filter((order) => order.status === status.code)
        .length,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [orderStatuses, filteredOrders]);

  const topFruitData = useMemo(
    () =>
      popular.slice(0, 6).map((fruit, index) => ({
        label: fruit.size ? `${fruit.fruit} · ${fruit.size}` : fruit.fruit,
        value: fruit.boxes,
        color: index === 0 ? CHART_COLORS[1] : undefined,
      })),
    [popular]
  );

  const statusFilter = useTableFilter(orderStatuses);
  const popularFilter = useTableFilter(popular);
  const completedFilter = useTableFilter(completed);
  const stockFilter = useTableFilter(stock);
  const purchaseFilter = useTableFilter(filteredPurchases);


  if (loading) {
    return <div className="reports-page"><p>Loading reports...</p></div>;
  }

  if (error) {
    return (
      <div className="reports-page">
        <h1>Sales and Reports</h1>
        <p className="orders-error">{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-heading">
        <div>
          <h1>Sales and Reports</h1>
          <p>Review sales performance and order activity.</p>
        </div>

        <label className="reports-period">
          Report period
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </label>
      </div>

      <div className="reports-cards">
        <div className="report-card">
          <span>Sales Revenue</span>
          <strong>{money(revenue)}</strong>
          <small>Completed orders only</small>
        </div>
        <div className="report-card">
          <span>Total Orders</span>
          <strong>{filteredOrders.length}</strong>
          <small>All statuses</small>
        </div>
        <div className="report-card">
          <span>Completed Orders</span>
          <strong>{completed.length}</strong>
          <small>Successfully completed</small>
        </div>
        <div className="report-card">
          <span>Pending Orders</span>
          <strong>{pending.length}</strong>
          <small>Awaiting confirmation</small>
        </div>
        <div className="report-card">
          <span>Cancelled Orders</span>
          <strong>{cancelled.length}</strong>
          <small>Excluded from revenue</small>
        </div>
      </div>

      <section className="reports-insights">
        <article className="chart-card chart-card-wide">
          <header className="chart-card-header">
            <div>
              <h2>Revenue trend</h2>
              <p>Completed order value across the selected window.</p>
            </div>
            <span className="chart-total">{money(revenue)}</span>
          </header>

          <TrendChart data={revenueTrend} formatValue={money} />
        </article>

        <article className="chart-card">
          <header className="chart-card-header">
            <div>
              <h2>Order status</h2>
              <p>Distribution of filtered orders.</p>
            </div>
          </header>

          <DonutChart
            data={statusChartData}
            total={filteredOrders.length}
            centerLabel="Orders"
          />
        </article>

        <article className="chart-card chart-card-full">
          <header className="chart-card-header">
            <div>
              <h2>Top fruits by boxes</h2>
              <p>Most ordered fruit products in this report.</p>
            </div>
          </header>

          <BarList
            items={topFruitData}
            formatValue={(value) => `${value} boxes`}
            emptyMessage="No fruit orders found for this period."
          />
        </article>
      </section>

      <section className="reports-section">
        <div className="reports-section-heading">
          <h2>Report details</h2>
          <p className="reports-description">
            Open a report to view, search, and filter the full table.
          </p>
        </div>

        <div className="report-launch-grid">
          <button
            type="button"
            className="report-launch-card"
            onClick={() => setActiveReport("status")}
          >
            <span className="report-launch-icon">
              <ReportIcon type="status" />
            </span>
            <span className="report-launch-copy">
              <strong>Order Status Summary</strong>
              <span>Breakdown of orders by status.</span>
            </span>
            <span className="report-launch-value">
              {filteredOrders.length}
              <small>orders</small>
            </span>
            <span className="report-launch-arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>

          <button
            type="button"
            className="report-launch-card"
            onClick={() => setActiveReport("popular")}
          >
            <span className="report-launch-icon">
              <ReportIcon type="popular" />
            </span>
            <span className="report-launch-copy">
              <strong>Popular Fruits</strong>
              <span>Fruit products ranked by boxes ordered.</span>
            </span>
            <span className="report-launch-value">
              {popular.length}
              <small>fruits</small>
            </span>
            <span className="report-launch-arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>

          <button
            type="button"
            className="report-launch-card"
            onClick={() => setActiveReport("completed")}
          >
            <span className="report-launch-icon">
              <ReportIcon type="completed" />
            </span>
            <span className="report-launch-copy">
              <strong>Completed Orders Sales</strong>
              <span>Completed orders and their sales value.</span>
            </span>
            <span className="report-launch-value">
              {completed.length}
              <small>sales</small>
            </span>
            <span className="report-launch-arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>

          <button
            type="button"
            className="report-launch-card"
            onClick={() => setActiveReport("stock")}
          >
            <span className="report-launch-icon">
              <ReportIcon type="stock" />
            </span>
            <span className="report-launch-copy">
              <strong>Stock Report</strong>
              <span>Current stock levels, pricing, and stock value.</span>
            </span>
            <span className="report-launch-value">
              {totalStockBoxes}
              <small>boxes</small>
            </span>
            <span className="report-launch-arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>

          <button
            type="button"
            className="report-launch-card"
            onClick={() => setActiveReport("purchases")}
          >
            <span className="report-launch-icon">
              <ReportIcon type="purchases" />
            </span>
            <span className="report-launch-copy">
              <strong>Purchases Report</strong>
              <span>Supplier purchases and spending for this period.</span>
            </span>
            <span className="report-launch-value">
              {filteredPurchases.length}
              <small>purchases</small>
            </span>
            <span className="report-launch-arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>
        </div>
      </section>

      {activeReport && (
        <Modal
          title={REPORT_META[activeReport].title}
          subtitle={REPORT_META[activeReport].subtitle}
          onClose={() => setActiveReport(null)}
          size="wide"
        >
          {activeReport === "status" && (
            <>
              <div className="report-modal-toolbar">
                <TableFilter
                  columns={statusFilterColumns}
                  rows={orderStatuses}
                  filterKey={statusFilter.filterKey}
                  filterValue={statusFilter.filterValue}
                  onChange={statusFilter.changeFilter}
                  onClear={statusFilter.clearFilter}
                />
                <span className="report-modal-total">
                  {statusFilter.filteredRows.length} statuses
                </span>
              </div>
              <div className="reports-table-container">
                <table className="reports-table">
                  <thead>
                    <tr><th>Status</th><th>Number of Orders</th></tr>
                  </thead>
                  <tbody>
                    {statusFilter.filteredRows.length ? statusFilter.filteredRows.map((statusOption) => (
                      <tr key={statusOption.code}>
                        <td>{statusOption.label}</td>
                        <td>
                          {filteredOrders.filter(
                            (order) => order.status === statusOption.code
                          ).length}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="2">No statuses match your filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === "popular" && (
            <>
              <div className="report-modal-toolbar">
                <TableFilter
                  columns={popularFilterColumns}
                  rows={popular}
                  filterKey={popularFilter.filterKey}
                  filterValue={popularFilter.filterValue}
                  onChange={popularFilter.changeFilter}
                  onClear={popularFilter.clearFilter}
                />
                <span className="report-modal-total">
                  {popularFilter.filteredRows.length} fruits
                </span>
              </div>
              <div className="reports-table-container">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Rank</th><th>Fruit</th><th>Box Size</th>
                      <th>Boxes Ordered</th><th>Completed Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popularFilter.filteredRows.length ? popularFilter.filteredRows.map((fruit, index) => (
                      <tr key={`${fruit.fruit}-${fruit.size}`}>
                        <td>{index + 1}</td>
                        <td>{fruit.fruit}</td>
                        <td>{fruit.size || "—"}</td>
                        <td>{fruit.boxes}</td>
                        <td>{money(fruit.sales)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5">No fruit order details match your filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === "completed" && (
            <>
              <div className="report-modal-toolbar">
                <TableFilter
                  columns={completedFilterColumns}
                  rows={completed}
                  filterKey={completedFilter.filterKey}
                  filterValue={completedFilter.filterValue}
                  onChange={completedFilter.changeFilter}
                  onClear={completedFilter.clearFilter}
                />
                <span className="report-modal-total">
                  {completedFilter.filteredRows.length} orders
                </span>
              </div>
              <div className="reports-table-container">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Order Number</th><th>Date</th>
                      <th>Vendor</th><th>Sales Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedFilter.filteredRows.length ? completedFilter.filteredRows.map((order) => (
                      <tr key={order.id}>
                        <td>{order.order_number}</td>
                        <td>{new Date(order.order_date).toLocaleDateString()}</td>
                        <td>{order.vendor_name || "—"}</td>
                        <td>{money(order.total_amount)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="4">No completed orders match your filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === "stock" && (
            <>
              <div className="report-modal-toolbar">
                <TableFilter
                  columns={stockReportFilterColumns}
                  rows={stock}
                  filterKey={stockFilter.filterKey}
                  filterValue={stockFilter.filterValue}
                  onChange={stockFilter.changeFilter}
                  onClear={stockFilter.clearFilter}
                />
                <span className="report-modal-total">
                  {stockFilter.filteredRows.length} products
                </span>
              </div>
              <p className="report-modal-note">
                Total boxes currently available:{" "}
                <strong>{totalStockBoxes}</strong> across {stock.length}{" "}
                products.
              </p>
              <div className="reports-table-container">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Fruit</th><th>Box Size</th>
                      <th>Selling Price</th><th>Available Boxes</th>
                      <th>Status</th><th>Stock Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockFilter.filteredRows.length ? stockFilter.filteredRows.map((product) => (
                      <tr key={product.product_id}>
                        <td>{product.fruit}</td>
                        <td>{product.box_size}</td>
                        <td>{money(product.selling_price)}</td>
                        <td>{product.quantity_available}</td>
                        <td>{product.status}</td>
                        <td>
                          {money(
                            (Number(product.selling_price) || 0) *
                              (Number(product.quantity_available) || 0)
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="6">No stock records match your filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === "purchases" && (
            <>
              <div className="report-modal-toolbar">
                <TableFilter
                  columns={purchaseReportFilterColumns}
                  rows={filteredPurchases}
                  filterKey={purchaseFilter.filterKey}
                  filterValue={purchaseFilter.filterValue}
                  onChange={purchaseFilter.changeFilter}
                  onClear={purchaseFilter.clearFilter}
                />
                <span className="report-modal-total">
                  {purchaseFilter.filteredRows.length} purchases
                </span>
              </div>
              <p className="report-modal-note">
                Purchases in this period:{" "}
                <strong>{filteredPurchases.length}</strong> — total spend{" "}
                <strong>{money(purchaseSpend)}</strong>.
              </p>
              <div className="reports-table-container">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Supplier</th><th>Fruit</th>
                      <th>Box Size</th><th>Quantity</th><th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseFilter.filteredRows.length ? purchaseFilter.filteredRows.map((purchase) => (
                      <tr key={purchase.id}>
                        <td>
                          {purchase.purchase_date
                            ? new Date(purchase.purchase_date).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>{purchase.supplier_name}</td>
                        <td>{purchase.fruit}</td>
                        <td>{purchase.box_size}</td>
                        <td>{purchase.quantity_boxes}</td>
                        <td>{money(purchase.total_cost)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="6">No purchases match your filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

export default Reports;
