
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../components/StatCard";
import { apiFetch } from "../api";

const API_URL = "http://localhost:5001/api";

const money = (amount) =>
  `M ${Number(amount || 0).toLocaleString("en-LS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const iconProps = {
  viewBox: "0 0 24 24",
  width: 22,
  height: 22,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

const icons = {
  fruit: (
    <svg {...iconProps}>
      <path d="M12 7c-2.5-2.5-6.5-1-6.5 3 0 3.5 2.7 7 4.5 7 .8 0 1.2-.5 2-.5s1.2.5 2 .5c1.8 0 4.5-3.5 4.5-7 0-4-4-5.5-6.5-3Z" />
      <path d="M12 7c0-2 1-3.2 3-3.2" />
    </svg>
  ),
  suppliers: (
    <svg {...iconProps}>
      <path d="M3 7h11v10H3z" />
      <path d="M14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="18" cy="18" r="1.6" />
    </svg>
  ),
  vendors: (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c.6-3.4 3.4-5.4 7-5.4s6.4 2 7 5.4" />
    </svg>
  ),
  stock: (
    <svg {...iconProps}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5" />
      <path d="M12 12v9" />
    </svg>
  ),
  orders: (
    <svg {...iconProps}>
      <path d="M7 4h10v17H7z" />
      <path d="M9 3h6v3H9z" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
      <path d="M9 18h4" />
    </svg>
  ),
  pending: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  completed: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  ),
  sales: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.2c-.6-.8-1.6-1.2-3-1.2-1.7 0-2.8.7-2.8 1.7 0 2.6 6 1.2 6 3.9 0 1.1-1.1 1.9-2.9 1.9-1.4 0-2.5-.5-3.1-1.4" />
      <path d="M12 6.8v10.4" />
    </svg>
  ),
};

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [fruits, setFruits] = useState([]);
  const [orderStatuses, setOrderStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [statsResponse, fruitsResponse, statusesResponse] =
          await Promise.all([
            apiFetch(`${API_URL}/dashboard`),
            apiFetch(`${API_URL}/fruits`),
            apiFetch(`${API_URL}/order-statuses`),
          ]);

        if (
          !statsResponse.ok ||
          !fruitsResponse.ok ||
          !statusesResponse.ok
        ) {
          throw new Error("Could not load dashboard data.");
        }

        const [statsData, fruitsData, statusesData] = await Promise.all([
          statsResponse.json(),
          fruitsResponse.json(),
          statusesResponse.json(),
        ]);

        setStats(statsData);
        setFruits(Array.isArray(fruitsData) ? fruitsData : []);
        setOrderStatuses(Array.isArray(statusesData) ? statusesData : []);
      } catch (err) {
        setError(
          `${err.message} Make sure the backend is running on port 5001.`
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  
const statistics = [
  { title: "Total Fruits", value: stats?.totalFruits ?? 0, icon: icons.fruit, tone: "green" },
  { title: "Total Suppliers", value: stats?.totalSuppliers ?? 0, icon: icons.suppliers, tone: "blue" },
  { title: "Registered Vendors", value: stats?.registeredVendors ?? 0, icon: icons.vendors, tone: "violet" },
  { title: "Available Stock", value: stats?.availableStock ?? 0, icon: icons.stock, tone: "teal" },
  { title: "Total Orders", value: stats?.totalOrders ?? 0, icon: icons.orders, tone: "slate" },
  { title: "Pending Orders", value: stats?.pendingOrders ?? 0, icon: icons.pending, tone: "amber" },
  { title: "Completed Orders", value: stats?.completedOrders ?? 0, icon: icons.completed, tone: "green" },
  { title: "Sales Value", value: money(stats?.salesValue), icon: icons.sales, tone: "gold" },
];


  return (
    <div className="dashboard">
      <header className="dashboard-hero">
        <div className="dashboard-hero-text">
          <span className="dashboard-eyebrow">Batloung Fruits Distribution</span>
          <h1>Dashboard Overview</h1>
          <p>
            A live snapshot of inventory, suppliers, vendors, orders and sales
            performance.
          </p>

          <div className="dashboard-hero-actions">
            <Link className="primary-button" to="/orders">
              View Orders
            </Link>
            <Link className="secondary-button" to="/reports">
              Open Reports
            </Link>
          </div>
        </div>

        <div className="dashboard-hero-art" aria-hidden="true">
          <span className="hero-orbit hero-orbit-1" />
          <span className="hero-orbit hero-orbit-2" />
          <span className="hero-orb">BF</span>
        </div>
      </header>

      {error && <p className="form-error">{error}</p>}

      <section className="statistics-grid">
        {loading
          ? statistics.map((item) => (
              <StatCard
                key={item.title}
                title={item.title}
                value="..."
                icon={item.icon}
                tone={item.tone}
              />
            ))
          : statistics.map((item) => (
              <StatCard
                key={item.title}
                title={item.title}
                value={item.value}
                icon={item.icon}
                tone={item.tone}
              />
            ))}
      </section>

      <section className="dashboard-content">
        <div className="content-card overview-card">
          <div className="overview-card-head">
            <div>
              <h3>Fruit Inventory</h3>
              <p className="overview-card-subtitle">
                Fruit types currently available for distribution.
              </p>
            </div>

            <div className="overview-card-tools">
              {!loading && (
                <span className="overview-count">{fruits.length}</span>
              )}
              <Link className="overview-link" to="/fruits">
                View all
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="overview-chip-list" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <span key={item} className="overview-skeleton-chip" />
              ))}
            </div>
          ) : fruits.length ? (
            <div className="overview-chip-list">
              {fruits.map((fruit) => (
                <span key={fruit.id} className="overview-chip">
                  {fruit.fruit_name}
                </span>
              ))}
            </div>
          ) : (
            <p className="overview-empty">No fruits found.</p>
          )}
        </div>

        <div className="content-card overview-card">
          <div className="overview-card-head">
            <div>
              <h3>Order Management</h3>
              <p className="overview-card-subtitle">
                Monitor street vendor orders and their progress.
              </p>
            </div>

            <div className="overview-card-tools">
              {!loading && (
                <span className="overview-count">{orderStatuses.length}</span>
              )}
              <Link className="overview-link" to="/orders">
                Open orders
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="overview-status-list" aria-hidden="true">
              {[1, 2, 3].map((item) => (
                <span key={item} className="overview-skeleton-row" />
              ))}
            </div>
          ) : orderStatuses.length ? (
            <ul className="overview-status-list">
              {orderStatuses.map((status, index) => (
                <li key={status.id}>
                  <span className="overview-status-dot" />
                  <span className="overview-status-name">{status.label}</span>
                  <span className="overview-status-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-empty">No order statuses found.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
