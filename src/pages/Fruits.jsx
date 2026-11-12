
import { useEffect, useState } from "react";
import { apiFetch, isAdmin } from "../api";
import useTableFilter from "../hooks/useTableFilter";
import { TableFilter } from "../components/TableFilter";
import Modal from "../components/Modal";
import { DeleteIcon, EditIcon } from "../components/ActionIcons";

const API_URL = "http://localhost:5001/api";

const emptyFruitForm = {
  fruit_name: "",
  description: "",
  status: "active",
};

const emptyProductForm = {
  fruit_id: "",
  box_size_id: "",
  quantity_per_box: "10",
  selling_price: "",
  quantity_available: "0",
  status: "active",
};

async function readResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || fallback);
  }

  return data;
}

const fruitFilterColumns = [
  { key: "fruit_name", label: "Fruit Name" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
];

const productFilterColumns = [
  { key: "fruit_name", label: "Fruit" },
  { key: "size_name", label: "Box Size" },
  { key: "status", label: "Status" },
];

function Fruits() {
  const [fruits, setFruits] = useState([]);
  const [products, setProducts] = useState([]);
  const [boxSizes, setBoxSizes] = useState([]);

  const [fruitForm, setFruitForm] = useState(emptyFruitForm);
  const [productForm, setProductForm] = useState(emptyProductForm);

  const [editingFruitId, setEditingFruitId] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [fruitModalOpen, setFruitModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingFruit, setSavingFruit] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const fruitFilter = useTableFilter(fruits);
  const productFilter = useTableFilter(products);
  const canManage = isAdmin();

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [fruitResponse, sizeResponse, productResponse] =
        await Promise.all([
          apiFetch(`${API_URL}/fruits`),
          apiFetch(`${API_URL}/box-sizes`),
          apiFetch(`${API_URL}/products`),
        ]);

      const [fruitData, sizeData, productData] = await Promise.all([
        readResponse(fruitResponse, "Failed to load fruits."),
        readResponse(sizeResponse, "Failed to load box sizes."),
        readResponse(productResponse, "Failed to load products."),
      ]);

      setFruits(Array.isArray(fruitData) ? fruitData : []);
      setBoxSizes(Array.isArray(sizeData) ? sizeData : []);
      setProducts(Array.isArray(productData) ? productData : []);
    } catch (err) {
      setError(
        `${err.message} Make sure the backend is running on port 5001 and the API routes exist.`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveFruit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSavingFruit(true);

    try {
      const url = editingFruitId
        ? `${API_URL}/fruits/${editingFruitId}`
        : `${API_URL}/fruits`;

      const result = await readResponse(
        await apiFetch(url, {
          method: editingFruitId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fruitForm),
        }),
        "Could not save fruit."
      );

      setNotice(
        result.message ||
          (editingFruitId
            ? "Fruit updated successfully."
            : "Fruit added successfully.")
      );

      setFruitForm(emptyFruitForm);
      setEditingFruitId(null);
      setFruitModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingFruit(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!productForm.fruit_id || !productForm.box_size_id) {
      setError("Please select a fruit and box size.");
      return;
    }

    const price = Number(productForm.selling_price);
    const perBox = Number(productForm.quantity_per_box);
    const stock = Number(productForm.quantity_available);

    if (!Number.isFinite(price) || price <= 0) {
      setError("Selling price must be greater than zero.");
      return;
    }

    if (!Number.isInteger(perBox) || perBox <= 0) {
      setError("Quantity per box must be a positive whole number.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be zero or a positive whole number.");
      return;
    }

    setSavingProduct(true);

    try {
      const url = editingProductId
        ? `${API_URL}/products/${editingProductId}`
        : `${API_URL}/products`;

      const result = await readResponse(
        await apiFetch(url, {
          method: editingProductId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fruit_id: Number(productForm.fruit_id),
            box_size_id: Number(productForm.box_size_id),
            quantity_per_box: perBox,
            selling_price: price,
            quantity_available: stock,
            status: productForm.status,
          }),
        }),
        "Could not save product."
      );

      setNotice(
        result.message ||
          (editingProductId
            ? "Product updated successfully."
            : "Product added successfully.")
      );

      setProductForm(emptyProductForm);
      setEditingProductId(null);
      setProductModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProduct(false);
    }
  }

  function editFruit(fruit) {
    setEditingFruitId(fruit.id);
    setFruitForm({
      fruit_name: fruit.fruit_name || "",
      description: fruit.description || "",
      status: fruit.status || "active",
    });
    setError("");
    setNotice("");
    setFruitModalOpen(true);
  }

  function editProduct(product) {
    setEditingProductId(product.id);
    setProductForm({
      fruit_id: String(product.fruit_id ?? ""),
      box_size_id: String(product.box_size_id ?? ""),
      quantity_per_box: String(product.quantity_per_box ?? ""),
      selling_price: String(product.selling_price ?? ""),
      quantity_available: String(product.quantity_available ?? "0"),
      status: product.status || "active",
    });
    setError("");
    setNotice("");
    setProductModalOpen(true);
  }

  async function deleteRecord(type, record) {
    const isFruit = type === "fruit";
    const label = isFruit
      ? record.fruit_name
      : `${record.fruit_name || "Product"} - ${record.size_name || "Box"}`;

    if (
      !window.confirm(
        `Delete ${label}? This action may be blocked if other records depend on it.`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const result = await readResponse(
        await apiFetch(
          `${API_URL}/${isFruit ? "fruits" : "products"}/${record.id}`,
          { method: "DELETE" }
        ),
        `Could not delete ${type}.`
      );

      setNotice(
        result.message || `${isFruit ? "Fruit" : "Product"} deleted successfully.`
      );

      if (isFruit && editingFruitId === record.id) {
        setEditingFruitId(null);
        setFruitForm(emptyFruitForm);
        setFruitModalOpen(false);
      }

      if (!isFruit && editingProductId === record.id) {
        setEditingProductId(null);
        setProductForm(emptyProductForm);
        setProductModalOpen(false);
      }

      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  function openFruitForm() {
    setFruitForm(emptyFruitForm);
    setEditingFruitId(null);
    setError("");
    setNotice("");
    setFruitModalOpen(true);
  }

  function openProductForm() {
    setProductForm(emptyProductForm);
    setEditingProductId(null);
    setError("");
    setNotice("");
    setProductModalOpen(true);
  }

  function cancelFruitEdit() {
    setEditingFruitId(null);
    setFruitForm(emptyFruitForm);
    setError("");
    setNotice("");
    setFruitModalOpen(false);
  }

  function cancelProductEdit() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setError("");
    setNotice("");
    setProductModalOpen(false);
  }

  return (
    <div className="fruits-page">
      <div className="page-heading">
        <div>
          <h1>Fruit Management</h1>
          <p>Manage fruit types, products, box sizes and stock.</p>
        </div>

        {canManage && (
          <div className="header-actions">
            <button type="button" className="primary-button" onClick={openFruitForm}>
              + Add Fruit Type
            </button>
            <button type="button" className="secondary-button" onClick={openProductForm}>
              + Add Fruit Product
            </button>
          </div>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      <section className="management-section">
        <div className="section-heading">
          <h2>Fruit Types</h2>
          <TableFilter
            columns={fruitFilterColumns}
            rows={fruits}
            filterKey={fruitFilter.filterKey}
            filterValue={fruitFilter.filterValue}
            onChange={fruitFilter.changeFilter}
            onClear={fruitFilter.clearFilter}
          />
        </div>
        {loading ? <p>Loading fruits...</p> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fruit Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fruits.length === 0 ? (
                  <tr><td colSpan="5">No fruit records found.</td></tr>
                ) : fruitFilter.filteredRows.length === 0 ? (
                  <tr><td colSpan="5">No fruit types match your filter.</td></tr>
                ) : fruitFilter.filteredRows.map((fruit) => (
                  <tr key={fruit.id}>
                    <td>{fruit.id}</td>
                    <td>{fruit.fruit_name}</td>
                    <td>{fruit.description || "—"}</td>
                    <td>{fruit.status || "—"}</td>
                    <td>
                      {canManage ? (
                        <>
                          <button type="button" className="edit-button" title="Edit" aria-label="Edit" onClick={() => editFruit(fruit)}><EditIcon /></button>{" "}
                          <button type="button" className="delete-button" title="Delete" aria-label="Delete" onClick={() => deleteRecord("fruit", fruit)}><DeleteIcon /></button>
                        </>
                      ) : (
                        <span className="text-muted">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="management-section">
        <div className="section-heading">
          <h2>Fruit Products and Stock</h2>
          <TableFilter
            columns={productFilterColumns}
            rows={products}
            filterKey={productFilter.filterKey}
            filterValue={productFilter.filterValue}
            onChange={productFilter.changeFilter}
            onClear={productFilter.clearFilter}
          />
        </div>
        {loading ? <p>Loading products...</p> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fruit</th>
                  <th>Box Size</th>
                  <th>Quantity per Box</th>
                  <th>Selling Price</th>
                  <th>Available Boxes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan="8">No product records found.</td></tr>
                ) : productFilter.filteredRows.length === 0 ? (
                  <tr><td colSpan="8">No products match your filter.</td></tr>
                ) : productFilter.filteredRows.map((product) => (
                  <tr key={product.id}>
                    <td>{product.id}</td>
                    <td>{product.fruit_name || `Fruit ID ${product.fruit_id}`}</td>
                    <td>{product.size_name || `Box ID ${product.box_size_id}`}</td>
                    <td>{product.quantity_per_box}</td>
                    <td>M {Number(product.selling_price || 0).toFixed(2)}</td>
                    <td>{product.quantity_available}</td>
                    <td>{product.status}</td>
                    <td>
                      {canManage ? (
                        <>
                          <button type="button" className="edit-button" title="Edit" aria-label="Edit" onClick={() => editProduct(product)}><EditIcon /></button>{" "}
                          <button type="button" className="delete-button" title="Delete" aria-label="Delete" onClick={() => deleteRecord("product", product)}><DeleteIcon /></button>
                        </>
                      ) : (
                        <span className="text-muted">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {fruitModalOpen && (
        <Modal
          title={editingFruitId ? "Edit Fruit Type" : "Add Fruit Type"}
          subtitle="Save a fruit type so it can be used by fruit products."
          onClose={cancelFruitEdit}
          size="small"
        >
          <form className="fruit-form product-form" onSubmit={saveFruit}>
            <div className="product-form-grid">
              <label>
                Fruit Name
                <input
                  value={fruitForm.fruit_name}
                  onChange={(event) =>
                    setFruitForm({ ...fruitForm, fruit_name: event.target.value })
                  }
                  maxLength="60"
                  placeholder="Please enter fruit name"
                  required
                />
              </label>

              <label>
                Description
                <input
                  value={fruitForm.description}
                  onChange={(event) =>
                    setFruitForm({ ...fruitForm, description: event.target.value })
                  }
                  maxLength="255"
                  placeholder="Optional description"
                />
              </label>

              <label>
                Status
                <select
                  value={fruitForm.status}
                  onChange={(event) =>
                    setFruitForm({ ...fruitForm, status: event.target.value })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={savingFruit}>
                {savingFruit ? "Saving..." : editingFruitId ? "Update Fruit" : "Save Fruit Type"}
              </button>
              <button type="button" onClick={cancelFruitEdit}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {productModalOpen && (
        <Modal
          title={editingProductId ? "Edit Fruit Product" : "Add Fruit Product"}
          subtitle="Link a fruit to a box size and set its price and stock."
          onClose={cancelProductEdit}
          size="large"
        >
          <form className="fruit-form product-form" onSubmit={saveProduct}>
            <div className="product-form-grid">
              <label>
                Fruit
                <select
                  value={productForm.fruit_id}
                  onChange={(event) =>
                    setProductForm({ ...productForm, fruit_id: event.target.value })
                  }
                  required
                >
                  <option value="">Select fruit</option>
                  {fruits.filter((fruit) => fruit.status !== "inactive").map((fruit) => (
                    <option key={fruit.id} value={fruit.id}>{fruit.fruit_name}</option>
                  ))}
                </select>
              </label>

              <label>
                Box Size
                <select
                  value={productForm.box_size_id}
                  onChange={(event) =>
                    setProductForm({ ...productForm, box_size_id: event.target.value })
                  }
                  required
                >
                  <option value="">Select box size</option>
                  {boxSizes.map((size) => (
                    <option key={size.id} value={size.id}>{size.size_name}</option>
                  ))}
                </select>
              </label>

              <label>
                Quantity per Box
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={productForm.quantity_per_box}
                  onChange={(event) =>
                    setProductForm({ ...productForm, quantity_per_box: event.target.value })
                  }
                  required
                />
              </label>

              <label>
                Selling Price (M)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={productForm.selling_price}
                  onChange={(event) =>
                    setProductForm({ ...productForm, selling_price: event.target.value })
                  }
                  placeholder="Please enter selling price"
                  required
                />
              </label>

              <label>
                Quantity in Stock (boxes)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.quantity_available}
                  onChange={(event) =>
                    setProductForm({ ...productForm, quantity_available: event.target.value })
                  }
                  required
                />
              </label>

              <label>
                Status
                <select
                  value={productForm.status}
                  onChange={(event) =>
                    setProductForm({ ...productForm, status: event.target.value })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            {loading && <p>Loading form options...</p>}
            {!loading && fruits.length === 0 && <p>Save a fruit type first to select it here.</p>}
            {!loading && boxSizes.length === 0 && <p>No box sizes are available yet.</p>}

            <div className="form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={savingProduct || loading || fruits.length === 0 || boxSizes.length === 0}
              >
                {savingProduct ? "Saving..." : editingProductId ? "Update Product" : "Save Product"}
              </button>
              <button type="button" onClick={cancelProductEdit}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Fruits;
