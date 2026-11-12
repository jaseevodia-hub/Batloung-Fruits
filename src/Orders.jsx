
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import useTableFilter from "./hooks/useTableFilter";
import { TableFilter } from "./components/TableFilter";
import Modal from "./components/Modal";
import { ViewIcon } from "./components/ActionIcons";

const API = "http://localhost:5001/api";

const orderFilterColumns = [
  { key: "order_number", label: "Order Number" },
  { key: "vendor_name", label: "Vendor" },
  { key: "business_name", label: "Business" },
  { key: "status", label: "Status" },
];

const orderItemFilterColumns = [
  { key: "fruit", label: "Fruit" },
  { key: "size", label: "Box Size" },
  { key: "quantity_boxes", label: "Quantity" },
];

async function parseResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || data.error || fallback
    );
  }

  return data;
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [orderStatuses, setOrderStatuses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState([
    { product_id: "", quantity_boxes: "" },
  ]);
  const [notes, setNotes] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const orderFilter = useTableFilter(orders);
  const orderItemsFilter = useTableFilter(selectedOrder?.items || []);

  function formatStatus(status) {
    const match = orderStatuses.find(
      (item) => item.code === status
    );

    if (match) return match.label;

    return String(status || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const responses = await Promise.all([
        apiFetch(`${API}/orders`),
        apiFetch(`${API}/vendors`),
        apiFetch(`${API}/products`),
        apiFetch(`${API}/order-statuses`),
      ]);

      const [
        ordersData,
        vendorsData,
        productsData,
        statusesData,
      ] = await Promise.all(
        responses.map((response) =>
          parseResponse(response, "Could not load order information.")
        )
      );

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setVendors(Array.isArray(vendorsData) ? vendorsData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrderStatuses(
        Array.isArray(statusesData) ? statusesData : []
      );
    } catch (err) {
      setError(
        `${err.message} Check that the backend is running on port 5001.`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateOrderStatus(orderId, newStatus) {
    setMessage("");
    setError("");
    setUpdatingId(orderId);

    try {
      await parseResponse(
        await apiFetch(`${API}/orders/${orderId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }),
        "Failed to update order status."
      );

      setMessage(
        `Order status updated to ${formatStatus(newStatus)}.`
      );

      await loadData();
      return true;
    } catch (err) {
      setMessage(err.message || "Could not update order status.");
      await loadData();
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function cancelOrder(order) {
    if (
      order.status === "completed" ||
      order.status === "cancelled"
    ) {
      setMessage(
        "Completed or already cancelled orders cannot be cancelled."
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to cancel ${order.order_number}?\n\nCancelling restores any deducted stock.`
    );

    if (!confirmed) return;

    setCancellingId(order.id);
    setMessage("");
    setError("");

    try {
      await parseResponse(
        await apiFetch(`${API}/orders/${order.id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "cancelled" }),
        }),
        "Could not cancel the order."
      );

      setMessage(`${order.order_number} was cancelled successfully.`);

      await loadData();

      if (selectedOrder?.id === order.id) {
        try {
          const detailsResponse = await apiFetch(
            `${API}/orders/${order.id}`
          );

          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json();
            setSelectedOrder(detailsData);
          }
        } catch {
          // The cancellation succeeded; details can be reopened.
        }
      }
    } catch (err) {
      setMessage(err.message || "Could not cancel the order.");
      await loadData();
    } finally {
      setCancellingId(null);
    }
  }

  async function viewOrderDetails(orderId) {
    setDetailsLoading(true);
    setSelectedOrder(null);
    setMessage("");
    setError("");

    try {
      const data = await parseResponse(
        await apiFetch(`${API}/orders/${orderId}`),
        "Failed to load order details."
      );

      setSelectedOrder(data);
    } catch (err) {
      setMessage(err.message || "Could not load order details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { product_id: "", quantity_boxes: "" },
    ]);
  }

  function removeItem(index) {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function resetOrderForm() {
    setVendorId("");
    setItems([{ product_id: "", quantity_boxes: "" }]);
    setNotes("");
  }

  function getProductId(product) {
    return product.id ?? product.product_id;
  }

  function getProductName(product) {
    const fruit = product.fruit ?? product.fruit_name ?? "Fruit";
    const size =
      product.size ?? product.box_size ?? product.size_name ?? "Box";

    return `${fruit} — ${size}`;
  }

  const total = items.reduce((sum, item) => {
    const product = products.find(
      (productItem) =>
        String(getProductId(productItem)) ===
        String(item.product_id)
    );

    return (
      sum +
      (Number(product?.selling_price) || 0) *
        (Number(item.quantity_boxes) || 0)
    );
  }, 0);

  async function createOrder(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!vendorId) {
      setMessage("Please select a vendor.");
      return;
    }

    if (
      items.length === 0 ||
      items.some(
        (item) =>
          !item.product_id ||
          !Number.isInteger(Number(item.quantity_boxes)) ||
          Number(item.quantity_boxes) < 1
      )
    ) {
      setMessage(
        "Select a product and enter a valid box quantity for every item."
      );
      return;
    }

    const duplicateProducts =
      items.some((item, index) =>
        items.some(
          (otherItem, otherIndex) =>
            index !== otherIndex &&
            String(item.product_id) ===
              String(otherItem.product_id)
        )
      );

    if (duplicateProducts) {
      setMessage(
        "Each product should appear only once. Combine its quantities into one row."
      );
      return;
    }

    const insufficientStock = items.some((item) => {
      const product = products.find(
        (productItem) =>
          String(getProductId(productItem)) ===
          String(item.product_id)
      );

      return (
        !product ||
        product.status !== "active" ||
        Number(item.quantity_boxes) >
          Number(product.quantity_available)
      );
    });

    if (insufficientStock) {
      setMessage(
        "One or more products are inactive or do not have enough boxes in stock."
      );
      return;
    }

    setSaving(true);

    try {
      await parseResponse(
        await apiFetch(`${API}/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vendor_id: Number(vendorId),
            items: items.map((item) => ({
              product_id: Number(item.product_id),
              quantity_boxes: Number(item.quantity_boxes),
            })),
            notes,
          }),
        }),
        "Could not create order."
      );

      setMessage("Order created successfully!");
      resetOrderForm();
      setShowForm(false);
      await loadData();
    } catch (err) {
      setMessage(err.message || "Could not create order.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="orders-page">
        <p>Loading orders...</p>
      </main>
    );
  }
  if (error && orders.length === 0) {
    return (
      <main className="orders-page">
        <p className="orders-error" role="alert">
          {error}
        </p>

        <button type="button" onClick={loadData}>
          Try Again
        </button>
      </main>
    );
  }

  return (
    <main className="orders-page">
      <header className="orders-heading">
        <div>
          <h1>Orders Management</h1>
        </div>

        <div className="orders-count">
          <span>Total Orders</span>
          <strong>{orders.length}</strong>
        </div>
      </header>

      {error && (
        <p className="orders-error" role="alert">
          {error}
        </p>
      )}

      <div className="orders-actions">
        <TableFilter
          columns={orderFilterColumns}
          rows={orders}
          filterKey={orderFilter.filterKey}
          filterValue={orderFilter.filterValue}
          onChange={orderFilter.changeFilter}
          onClear={orderFilter.clearFilter}
        />

        <button
          type="button"
          className="new-order-button"
          onClick={() => {
            setMessage("");
            setShowForm((current) => !current);
          }}
        >
          {showForm ? "Close Form" : "+ New Order"}
        </button>

        <button type="button" className="refresh-button" onClick={loadData}>
          Refresh
        </button>
      </div>

      {message && (
        <p className="orders-message" role="status">
          {message}
        </p>
      )}

      {showForm && (
        <Modal
          title="Create New Order"
          subtitle="Select a vendor and add the products they need."
          onClose={() => setShowForm(false)}
          size="large"
        >
        <form className="new-order-form" onSubmit={createOrder}>
          <label htmlFor="vendor">Select Vendor *</label>
          <select
            id="vendor"
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
            required
          >
            <option value="">Choose a vendor</option>

            {vendors
              .filter((vendor) => vendor.status === "active")
              .map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendor_name} — {vendor.business_name}
                </option>
              ))}
          </select>

          <h3>Order Items</h3>

          {items.map((item, index) => (
            <div className="order-item-row" key={index}>
              <div className="order-field">
                <label htmlFor={`product-${index}`}>
                  Fruit Product *
                </label>

                <select
                  id={`product-${index}`}
                  value={item.product_id}
                  onChange={(event) =>
                    updateItem(
                      index,
                      "product_id",
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">Choose a product</option>

                  {products
                    .filter(
                      (product) =>
                        product.status === "active" &&
                        Number(product.quantity_available) > 0
                    )
                    .map((product) => (
                      <option
                        key={getProductId(product)}
                        value={getProductId(product)}
                      >
                        {getProductName(product)} (M{" "}
                        {Number(product.selling_price).toFixed(2)},
                        {" "}stock: {product.quantity_available})
                      </option>
                    ))}
                </select>
              </div>

              <div className="order-field">
                <label htmlFor={`quantity-${index}`}>
                  Boxes *
                </label>

                <input
                  id={`quantity-${index}`}
                  type="number"
                  min="1"
                  step="1"
                  max={
                    products.find(
                      (product) =>
                        String(getProductId(product)) ===
                        String(item.product_id)
                    )?.quantity_available
                  }
                  value={item.quantity_boxes}
                  onChange={(event) =>
                    updateItem(
                      index,
                      "quantity_boxes",
                      event.target.value
                    )
                  }
                  required
                />
              </div>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={addItem}>
            + Add Another Product
          </button>

          <label htmlFor="order-notes">Notes (optional)</label>
          <textarea
            id="order-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Enter any special instructions"
            rows={3}
          />

          <div className="order-total">
            Estimated Total: M{" "}
            {total.toLocaleString("en-LS", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>

          <button type="submit" disabled={saving}>
            {saving ? "Creating Order..." : "Create Order"}
          </button>
        </form>
        </Modal>
      )}

      {detailsLoading && <p>Loading order details...</p>}

      {selectedOrder && (
        <Modal
          title="Order Details"
          subtitle={selectedOrder.order_number}
          onClose={() => setSelectedOrder(null)}
          size="large"
        >
        <section className="order-details">
          <div className="order-details-info">
            <p>
              <strong>Vendor:</strong>{" "}
              {selectedOrder.vendor_name}
            </p>

            <p>
              <strong>Business:</strong>{" "}
              {selectedOrder.business_name}
            </p>

            <p>
              <strong>Date:</strong>{" "}
              {selectedOrder.order_date
                ? new Date(
                    selectedOrder.order_date
                  ).toLocaleDateString()
                : "—"}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {formatStatus(selectedOrder.status)}
            </p>

            <p>
              <strong>Total:</strong> M{" "}
              {Number(selectedOrder.total_amount).toFixed(2)}
            </p>

            <p>
              <strong>Notes:</strong>{" "}
              {selectedOrder.notes || "No notes"}
            </p>
          </div>

          {selectedOrder.status !== "completed" &&
            selectedOrder.status !== "cancelled" && (
              <button
                type="button"
                disabled={cancellingId === selectedOrder.id}
                onClick={() => cancelOrder(selectedOrder)}
              >
                {cancellingId === selectedOrder.id
                  ? "Cancelling..."
                  : "Cancel This Order"}
              </button>
            )}

          <h3>Products Ordered</h3>

          <div className="table-search-controls">
            <TableFilter
              columns={orderItemFilterColumns}
              rows={selectedOrder.items || []}
              filterKey={orderItemsFilter.filterKey}
              filterValue={orderItemsFilter.filterValue}
              onChange={orderItemsFilter.changeFilter}
              onClear={orderItemsFilter.clearFilter}
            />
          </div>

          <div className="orders-table-container">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Fruit</th>
                  <th>Box Size</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>

              <tbody>
                {orderItemsFilter.filteredRows.map(
                  (item, index) => (
                    <tr key={item.id || index}>
                      <td>{item.fruit}</td>
                      <td>{item.size}</td>
                      <td>{item.quantity_boxes}</td>
                      <td>
                        M {Number(item.unit_price).toFixed(2)}
                      </td>
                      <td>
                        M {Number(item.subtotal).toFixed(2)}
                      </td>
                    </tr>
                  )
                )}

                {(!selectedOrder.items ||
                  selectedOrder.items.length === 0) && (
                  <tr>
                    <td colSpan={5} className="orders-empty">
                      No order items were returned.
                    </td>
                  </tr>
                )}

                {selectedOrder.items &&
                  selectedOrder.items.length > 0 &&
                  orderItemsFilter.filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="orders-empty">
                        No order items match your filter.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </section>
        </Modal>
      )}

      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Vendor</th>
              <th>Business</th>
              <th>Order Date</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Update Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="orders-empty">
                  No orders found.
                </td>
              </tr>
            ) : orderFilter.filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="orders-empty">
                  No orders match your filter.
                </td>
              </tr>
            ) : (
              orderFilter.filteredRows.map((order) => (
                <tr key={order.id}>
                  <td className="order-number">
                    {order.order_number}
                  </td>

                  <td>{order.vendor_name}</td>
                  <td>{order.business_name}</td>

                  <td>
                    {order.order_date
                      ? new Date(
                          order.order_date
                        ).toLocaleDateString()
                      : "—"}
                  </td>

                  <td className="order-amount">
                    M{" "}
                    {Number(order.total_amount).toLocaleString(
                      "en-LS",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </td>

                  <td>
                    <span
                      className={`order-status status-${order.status}`}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </td>

                  <td>
                    <select
                      value={order.status}
                      onChange={(event) =>
                        updateOrderStatus(
                          order.id,
                          event.target.value
                        )
                      }
                      disabled={
                        updatingId === order.id ||
                        order.status === "completed" ||
                        order.status === "cancelled"
                      }
                      aria-label={`Update status for ${order.order_number}`}
                    >
                      {orderStatuses.map((statusOption) => (
                        <option
                          key={statusOption.code}
                          value={statusOption.code}
                        >
                          {statusOption.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <div className="orders-row-actions">
                      <button
                        type="button"
                        className="view-btn"
                        title="View"
                        aria-label="View"
                        onClick={() => viewOrderDetails(order.id)}
                      >
                        <ViewIcon />
                      </button>

                      <button
                        type="button"
                        className="cancel-order-button"
                        onClick={() => cancelOrder(order)}
                        disabled={
                          cancellingId === order.id ||
                          order.status === "completed" ||
                          order.status === "cancelled"
                        }
                      >
                        {cancellingId === order.id
                          ? "Cancelling..."
                          : order.status === "cancelled"
                            ? "Cancelled"
                            : "Cancel Order"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
