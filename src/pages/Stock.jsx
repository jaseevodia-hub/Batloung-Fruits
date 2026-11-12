
import { useEffect, useState } from "react";
import { apiFetch, isAdmin } from "../api";
import useTableFilter from "../hooks/useTableFilter";
import { TableFilter } from "../components/TableFilter";
import Modal from "../components/Modal";
import { DeleteIcon, EditIcon } from "../components/ActionIcons";

const API = "http://localhost:5001/api";

const today = () => new Date().toISOString().slice(0, 10);

const emptyPurchase = {
  supplier_id: "",
  product_id: "",
  quantity_boxes: "1",
  unit_cost: "",
  purchase_date: today(),
  notes: "",
};

const stockFilterColumns = [
  { key: "fruit", label: "Fruit" },
  { key: "box_size", label: "Box Size" },
  { key: "status", label: "Status" },
];

const purchaseFilterColumns = [
  { key: "supplier_name", label: "Supplier" },
  { key: "fruit", label: "Fruit" },
  { key: "box_size", label: "Box Size" },
  { key: "purchase_date", label: "Purchase Date" },
  { key: "notes", label: "Notes" },
];

async function parseResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || fallback);
  }

  return data;
}

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase);
  const [stockForm, setStockForm] = useState({
    product_id: "",
    quantity: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const stockFilter = useTableFilter(products);
  const purchaseFilter = useTableFilter(purchases);
  const canManage = isAdmin();

  async function loadPurchases() {
    setLoadingPurchases(true);
    try {
      const resp = await apiFetch(`${API}/purchases`);
      const data = await resp.json().catch(() => []);
      if (!resp.ok) throw new Error(data.message || "Could not load purchases.");
      setPurchases(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPurchases(false);
    }
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const responses = await Promise.all([
        apiFetch(`${API}/stock`),
        apiFetch(`${API}/suppliers`),
      ]);

      const [stockData, supplierData] = await Promise.all(
        responses.map((response) =>
          parseResponse(response, "Could not load stock or suppliers.")
        )
      );

      const loadedProducts = Array.isArray(stockData) ? stockData : [];
      const loadedSuppliers = Array.isArray(supplierData)
        ? supplierData
        : [];

      setProducts(loadedProducts);
      setSuppliers(loadedSuppliers);

      setPurchaseForm((current) => ({
        ...current,
        supplier_id:
          current.supplier_id ||
          (loadedSuppliers[0] ? String(loadedSuppliers[0].id) : ""),
        product_id:
          current.product_id ||
          (loadedProducts[0]
            ? String(loadedProducts[0].product_id)
            : ""),
      }));

      setStockForm((current) => {
        const selectedProduct = loadedProducts.find(
          (product) =>
            String(product.product_id) === current.product_id
        );

        return {
          product_id: selectedProduct
            ? current.product_id
            : loadedProducts[0]
              ? String(loadedProducts[0].product_id)
              : "",
          quantity: selectedProduct
            ? current.quantity
            : loadedProducts[0]
              ? String(loadedProducts[0].quantity_available)
              : "",
        };
      });
      await loadPurchases();
    } catch (err) {
      setError(
        `${err.message} Make sure the backend is running on port 5001.`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handlePurchaseChange(event) {
    const { name, value } = event.target;

    setPurchaseForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleStockProductChange(event) {
    const productId = event.target.value;

    const selected = products.find(
      (product) => String(product.product_id) === productId
    );

    setStockForm({
      product_id: productId,
      quantity: selected
        ? String(selected.quantity_available)
        : "",
    });
  }

  async function savePurchase(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const boxes = Number(purchaseForm.quantity_boxes);
    const cost = Number(purchaseForm.unit_cost);

    if (
      !purchaseForm.supplier_id ||
      !purchaseForm.product_id ||
      !Number.isInteger(boxes) ||
      boxes <= 0 ||
      purchaseForm.unit_cost.trim() === "" ||
      !Number.isFinite(cost) ||
      cost < 0 ||
      !purchaseForm.purchase_date
    ) {
      setError(
        "Select a supplier and product, enter a valid quantity and cost, and choose a purchase date."
      );
      return;
    }

    setSavingPurchase(true);

    try {
      const result = await parseResponse(
        await apiFetch(`${API}/purchases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...purchaseForm,
            supplier_id: Number(purchaseForm.supplier_id),
            product_id: Number(purchaseForm.product_id),
            quantity_boxes: boxes,
            unit_cost: cost,
          }),
        }),
        "Could not record purchase."
      );

      setNotice(
        `${result.message || "Purchase recorded successfully."} Total cost: M ${Number(
          result.total_cost ?? boxes * cost
        ).toFixed(2)}.`
      );

      setPurchaseForm({
        ...emptyPurchase,
        supplier_id: suppliers[0] ? String(suppliers[0].id) : "",
        product_id: products[0]
          ? String(products[0].product_id)
          : "",
      });

      setPurchaseOpen(false);

      await loadData();
      await loadPurchases();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPurchase(false);
    }
  }

  async function saveStock(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const quantity = Number(stockForm.quantity);

    if (
      !stockForm.product_id ||
      stockForm.quantity.trim() === "" ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      setError(
        "Choose a product and enter a whole-number stock quantity of zero or more."
      );
      return;
    }

    setSavingStock(true);

    try {
      const result = await parseResponse(
        await apiFetch(`${API}/stock/${stockForm.product_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity_available: quantity,
          }),
        }),
        "Could not update stock."
      );

      setNotice(result.message || "Stock quantity updated successfully.");
      setStockOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingStock(false);
    }
  }

  function openPurchaseForm() {
    setError("");
    setNotice("");
    setPurchaseOpen(true);
  }

  function openStockForm() {
    setError("");
    setNotice("");
    setStockOpen(true);
  }

  function handleEditStock(product) {
    setStockForm({
      product_id: String(product.product_id),
      quantity: String(product.quantity_available),
    });
    setError("");
    setNotice("");
    setStockOpen(true);
  }

  async function handleDeleteProduct(product) {
    if (
      !window.confirm(
        `Delete ${product.fruit} — ${product.box_size}? This action may be blocked if other records depend on it.`
      )
    ) {
      return;
    }

    setDeletingId(product.product_id);
    setError("");
    setNotice("");

    try {
      const result = await parseResponse(
        await apiFetch(`${API}/products/${product.product_id}`, {
          method: "DELETE",
        }),
        "Could not delete product."
      );
      setNotice(result.message || "Product deleted successfully.");

      if (String(stockForm.product_id) === String(product.product_id)) {
        setStockForm({ product_id: "", quantity: "" });
      }

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const totalBoxes = products.reduce(
    (total, product) =>
      total + Number(product.quantity_available || 0),
    0
  );

  const selectedProduct = products.find(
    (product) =>
      String(product.product_id) === stockForm.product_id
  );

  const purchaseTotal =
    Math.max(0, Number(purchaseForm.quantity_boxes) || 0) *
    Math.max(0, Number(purchaseForm.unit_cost) || 0);

  return (
    <main className="management-page">
      <header className="page-header">
        <div>
          <h1>Stock Management</h1>
          <p>Record fruit purchases and manage available stock.</p>
        </div>

        {canManage && (
          <div className="header-actions">
            <button type="button" className="primary-button" onClick={openPurchaseForm}>
              + Record Purchase
            </button>
            <button type="button" className="secondary-button" onClick={openStockForm}>
              Update Stock
            </button>
          </div>
        )}
      </header>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}

      <div className="management-toolbar">
        <span>Products: {products.length}</span>
        <span>Total boxes in stock: {totalBoxes}</span>
      </div>

      {loading ? (
        <p>Loading stock and supplier information...</p>
      ) : (
        <>
          <section className="management-section">
            <div className="section-heading">
              <h2>Purchases</h2>
              <TableFilter
                columns={purchaseFilterColumns}
                rows={purchases}
                filterKey={purchaseFilter.filterKey}
                filterValue={purchaseFilter.filterValue}
                onChange={purchaseFilter.changeFilter}
                onClear={purchaseFilter.clearFilter}
              />
            </div>
            {loadingPurchases ? (
              <p>Loading purchases...</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Supplier</th>
                      <th>Fruit</th>
                      <th>Box Size</th>
                      <th>Quantity</th>
                      <th>Unit Cost</th>
                      <th>Total Cost</th>
                      <th>Purchase Date</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.length === 0 ? (
                      <tr>
                        <td colSpan="9">No purchases recorded yet.</td>
                      </tr>
                    ) : purchaseFilter.filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan="9">No purchases match your filter.</td>
                      </tr>
                    ) : (
                      purchaseFilter.filteredRows.map((purchase) => (
                        <tr key={purchase.id}>
                          <td>{purchase.id}</td>
                          <td>{purchase.supplier_name}</td>
                          <td>{purchase.fruit}</td>
                          <td>{purchase.box_size}</td>
                          <td>{purchase.quantity_boxes}</td>
                          <td>M {Number(purchase.unit_cost || 0).toFixed(2)}</td>
                          <td>M {Number(purchase.total_cost || 0).toFixed(2)}</td>
                          <td>{purchase.purchase_date ? new Date(purchase.purchase_date).toISOString().split("T")[0] : ""}</td>
                          <td>{purchase.notes || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="management-section">
            <h2>Stock Summary</h2>
            <div className="table-search-controls">
              <TableFilter
                columns={stockFilterColumns}
                rows={products}
                filterKey={stockFilter.filterKey}
                filterValue={stockFilter.filterValue}
                onChange={stockFilter.changeFilter}
                onClear={stockFilter.clearFilter}
              />
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fruit</th>
                    <th>Box Size</th>
                    <th>Qty/Box</th>
                    <th>Selling Price</th>
                    <th>Available Boxes</th>
                    <th>Status</th>
                    {canManage && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {stockFilter.filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 8 : 7}>No stock records match your filter.</td>
                    </tr>
                  ) : (
                    stockFilter.filteredRows.map((product) => (
                      <tr key={product.product_id}>
                        <td>{product.product_id}</td>
                        <td>{product.fruit}</td>
                        <td>{product.box_size}</td>
                        <td>{product.quantity_per_box}</td>
                        <td>M {Number(product.selling_price || 0).toFixed(2)}</td>
                        <td>{product.quantity_available}</td>
                        <td>{product.status}</td>
                        {canManage && (
                          <td>
                            <button
                              type="button"
                              className="edit-button"
                              title="Edit"
                              aria-label="Edit"
                              onClick={() => handleEditStock(product)}
                            >
                              <EditIcon />
                            </button>{" "}
                            <button
                              type="button"
                              className="delete-button"
                              title={deletingId === product.product_id ? "Deleting..." : "Delete"}
                              aria-label={deletingId === product.product_id ? "Deleting..." : "Delete"}
                              onClick={() => handleDeleteProduct(product)}
                              disabled={deletingId === product.product_id}
                            >
                              <DeleteIcon />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {purchaseOpen && (
        <Modal
          title="Record New Purchase"
          subtitle="Record a purchase and increase the available stock."
          onClose={() => setPurchaseOpen(false)}
          size="large"
        >
          <form className="management-form" onSubmit={savePurchase}>
            <div className="product-form-grid">
              <label>
                Supplier *
                <select
                  name="supplier_id"
                  value={purchaseForm.supplier_id}
                  onChange={handlePurchaseChange}
                  required
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Fruit Product / Box Size *
                <select
                  name="product_id"
                  value={purchaseForm.product_id}
                  onChange={handlePurchaseChange}
                  required
                >
                  <option value="">Select product</option>
                  {products
                    .filter((product) => product.status === "active")
                    .map((product) => (
                      <option
                        key={product.product_id}
                        value={product.product_id}
                      >
                        {product.fruit} — {product.box_size} (
                        {product.quantity_available} boxes available)
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Quantity Purchased (boxes) *
                <input
                  name="quantity_boxes"
                  type="number"
                  min="1"
                  step="1"
                  value={purchaseForm.quantity_boxes}
                  onChange={handlePurchaseChange}
                  required
                />
              </label>

              <label>
                Cost per Box (M) *
                <input
                  name="unit_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseForm.unit_cost}
                  onChange={handlePurchaseChange}
                  placeholder="Please enter cost per box"
                  required
                />
              </label>

              <label>
                Purchase Date *
                <input
                  name="purchase_date"
                  type="date"
                  value={purchaseForm.purchase_date}
                  onChange={handlePurchaseChange}
                  required
                />
              </label>

              <label>
                Notes (optional)
                <input
                  name="notes"
                  type="text"
                  maxLength="255"
                  value={purchaseForm.notes}
                  onChange={handlePurchaseChange}
                  placeholder="Please enter notes"
                />
              </label>
            </div>

            <p className="purchase-total">
              <strong>Total Purchase Cost:</strong>{" "}
              M{" "}
              {purchaseTotal.toLocaleString("en-LS", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={
                  savingPurchase ||
                  suppliers.length === 0 ||
                  !products.some((product) => product.status === "active")
                }
              >
                {savingPurchase ? "Saving Purchase..." : "Save Purchase"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPurchaseForm({
                    ...emptyPurchase,
                    supplier_id: suppliers[0]
                      ? String(suppliers[0].id)
                      : "",
                    product_id: products[0]
                      ? String(products[0].product_id)
                      : "",
                  });
                  setError("");
                  setNotice("");
                }}
              >
                Clear Form
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setPurchaseOpen(false)}
              >
                Cancel
              </button>
            </div>

            {suppliers.length === 0 && (
              <p>Add a supplier before recording a purchase.</p>
            )}

            {!products.some(
              (product) => product.status === "active"
            ) && (
              <p>
                An active product is required before recording a purchase.
              </p>
            )}
          </form>
        </Modal>
      )}

      {stockOpen && (
        <Modal
          title="Update Available Stock"
          subtitle="Set the current number of boxes available for a product."
          onClose={() => setStockOpen(false)}
          size="medium"
        >
          <form className="management-form" onSubmit={saveStock}>
            <div className="product-form-grid">
              <label>
                Select Fruit Product *
                <select
                  value={stockForm.product_id}
                  onChange={handleStockProductChange}
                  required
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option
                      key={product.product_id}
                      value={product.product_id}
                    >
                      {product.fruit} — {product.box_size}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Available Boxes *
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stockForm.quantity}
                  onChange={(event) =>
                    setStockForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>

            {selectedProduct && (
              <p>
                Current saved stock:{" "}
                <strong>{selectedProduct.quantity_available} boxes</strong>
              </p>
            )}

            <div className="form-actions">
              <button
                type="submit"
                disabled={savingStock || products.length === 0}
              >
                {savingStock ? "Updating Stock..." : "Save Stock"}
              </button>

              <button type="button" onClick={() => setStockOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
