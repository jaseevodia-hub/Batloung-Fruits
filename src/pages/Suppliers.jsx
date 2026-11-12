
import { useEffect, useState } from "react";
import { apiFetch, isAdmin, API_URL } from "../api";
import useTableFilter from "../hooks/useTableFilter";
import { TableFilter } from "../components/TableFilter";
import Modal from "../components/Modal";
import { DeleteIcon, EditIcon } from "../components/ActionIcons";


const emptyForm = {
  supplier_name: "",
  province_id: "",
  contact_person: "",
  telephone: "",
  email: "",
  physical_address: "",
};

const supplierFilterColumns = [
  { key: "supplier_name", label: "Supplier Name" },
  { key: "province_name", label: "Province" },
  { key: "contact_person", label: "Contact Person" },
  { key: "telephone", label: "Telephone" },
  { key: "email", label: "Email" },
  { key: "physical_address", label: "Physical Address" },
];

export default function Suppliers() {
  const [provinces, setProvinces] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const canManage = isAdmin();

  async function readResponse(response) {
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message || result.error || "The request failed."
      );
    }

    return result;
  }

  async function loadData() {
    setError("");
    setDataLoading(true);

    try {
      const [provinceResponse, supplierResponse] = await Promise.all([
        apiFetch(`${API_URL}/provinces`),
        apiFetch(`${API_URL}/suppliers`),
      ]);

      const [provinceData, supplierData] = await Promise.all([
        readResponse(provinceResponse),
        readResponse(supplierResponse),
      ]);

      setProvinces(
        Array.isArray(provinceData) ? provinceData : []
      );

      setSuppliers(
        Array.isArray(supplierData) ? supplierData : []
      );
    } catch (err) {
      setError(err.message || "Could not load suppliers.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  function openCreateForm() {
    resetForm();
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setFormOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const url = editingId
        ? `${API_URL}/suppliers/${editingId}`
        : `${API_URL}/suppliers`;

      const response = await apiFetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          province_id: Number(form.province_id),
        }),
      });

      const result = await readResponse(response);

      setMessage(
        result.message ||
          (editingId
            ? "Supplier updated successfully."
            : "Supplier saved successfully.")
      );

      resetForm();
      setFormOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save supplier.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(supplier) {
    setEditingId(supplier.id);

    setForm({
      supplier_name: supplier.supplier_name || "",
      province_id: String(supplier.province_id || ""),
      contact_person: supplier.contact_person || "",
      telephone: supplier.telephone || "",
      email: supplier.email || "",
      physical_address: supplier.physical_address || "",
    });

    setMessage("");
    setError("");
    setFormOpen(true);
  }

  async function handleDelete(supplier) {
    const confirmed = window.confirm(
      `Delete supplier "${supplier.supplier_name}"? This may be blocked if the supplier has related purchase records.`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");
    setDeletingId(supplier.id);

    try {
      const response = await apiFetch(
        `${API_URL}/suppliers/${supplier.id}`,
        { method: "DELETE" }
      );

      const result = await readResponse(response);

      setMessage(
        result.message || "Supplier deleted successfully."
      );

      if (editingId === supplier.id) {
        resetForm();
        setFormOpen(false);
      }

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Could not delete supplier. Check whether it has related purchase records."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function getProvinceName(supplier) {
    if (supplier.province_name) {
      return supplier.province_name;
    }

    const province = provinces.find(
      (item) =>
        Number(item.id) === Number(supplier.province_id)
    );

    return province?.name || "Not specified";
  }

  const filterableSuppliers = suppliers.map((supplier) => ({
    ...supplier,
    province_name: getProvinceName(supplier),
  }));
  const supplierFilter = useTableFilter(filterableSuppliers);

  return (
    <main className="suppliers-page management-page">
      <header className="suppliers-header page-header">
        <div>
          <h1>Supplier Management</h1>
          <p>
            Register, view, update and manage fruit suppliers.
          </p>
        </div>

        <div className="header-actions">
          {canManage && (
            <button
              type="button"
              className="supplier-button supplier-button-primary"
              onClick={openCreateForm}
            >
              + Add Supplier
            </button>
          )}

          <div className="suppliers-count">
            <span>Total Suppliers</span>
            <strong>{suppliers.length}</strong>
          </div>
        </div>
      </header>

      {message && (
        <div className="supplier-message success-message" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="supplier-error error-message" role="alert">
          {error}
        </div>
      )}

      <section className="supplier-panel">
        <div className="supplier-table-heading">
          <div>
            <h2>Registered Suppliers</h2>
            <p>Total suppliers: {suppliers.length}</p>
          </div>

          <div className="table-search-controls">
            <TableFilter
              columns={supplierFilterColumns}
              rows={filterableSuppliers}
              filterKey={supplierFilter.filterKey}
              filterValue={supplierFilter.filterValue}
              onChange={supplierFilter.changeFilter}
              onClear={supplierFilter.clearFilter}
            />

            <button
              className="supplier-button supplier-button-secondary refresh-button"
              type="button"
              onClick={loadData}
              disabled={dataLoading}
            >
              {dataLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {dataLoading && suppliers.length === 0 ? (
          <p>Loading suppliers...</p>
        ) : (
          <div className="supplier-table-wrapper orders-table-container">
            <table className="supplier-table orders-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Supplier Name</th>
                  <th>Province</th>
                  <th>Contact Person</th>
                  <th>Telephone</th>
                  <th>Email</th>
                  <th>Physical Address</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {supplierFilter.filteredRows.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.id}</td>
                    <td>{supplier.supplier_name}</td>
                    <td>{getProvinceName(supplier)}</td>
                    <td>{supplier.contact_person || "—"}</td>
                    <td>{supplier.telephone || "—"}</td>
                    <td>{supplier.email || "—"}</td>
                    <td>{supplier.physical_address || "—"}</td>
                    <td>
                      {canManage ? (
                      <div className="supplier-row-actions orders-row-actions">
                        <button
                          className="supplier-button supplier-button-edit"
                          type="button"
                          title="Edit"
                          aria-label="Edit"
                          onClick={() => handleEdit(supplier)}
                        >
                          <EditIcon />
                        </button>

                        <button
                          className="supplier-button supplier-button-delete cancel-order-button"
                          type="button"
                          title={deletingId === supplier.id ? "Deleting..." : "Delete"}
                          aria-label={deletingId === supplier.id ? "Deleting..." : "Delete"}
                          onClick={() => handleDelete(supplier)}
                          disabled={deletingId === supplier.id}
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                      ) : (
                        <span className="text-muted">View only</span>
                      )}
                    </td>
                  </tr>
                ))}

                {supplierFilter.filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="supplier-empty orders-empty">
                      {dataLoading
                        ? "Loading suppliers..."
                        : suppliers.length === 0
                          ? "No suppliers found."
                          : "No suppliers match your filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <Modal
          title={editingId ? "Edit Supplier" : "Supplier Registration"}
          subtitle="Register a fruit supplier and their contact details."
          onClose={closeForm}
          size="large"
        >
          <section className="supplier-panel management-form">
            <form onSubmit={handleSubmit}>
              <div className="supplier-form-grid product-form-grid">
                <label className="supplier-field">
                  Supplier Name *
                  <input
                    name="supplier_name"
                    value={form.supplier_name}
                    onChange={handleChange}
                    placeholder="Enter supplier name"
                    required
                  />
                </label>

                <label className="supplier-field">
                  Province *
                  <select
                    name="province_id"
                    value={form.province_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a province</option>

                    {provinces.map((province) => (
                      <option key={province.id} value={province.id}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="supplier-field">
                  Contact Person
                  <input
                    name="contact_person"
                    value={form.contact_person}
                    onChange={handleChange}
                    placeholder="Enter contact person"
                  />
                </label>

                <label className="supplier-field">
                  Telephone Number *
                  <input
                    name="telephone"
                    type="tel"
                    value={form.telephone}
                    onChange={handleChange}
                    placeholder="Enter telephone number"
                    required
                  />
                </label>

                <label className="supplier-field">
                  Email Address
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                  />
                </label>

                <label className="supplier-field">
                  Physical Address
                  <input
                    name="physical_address"
                    value={form.physical_address}
                    onChange={handleChange}
                    placeholder="Enter physical address"
                  />
                </label>
              </div>

              {provinces.length === 0 && (
                <p className="supplier-warning">
                  No provinces are available. Please check the provinces
                  table and API.
                </p>
              )}

              <div className="supplier-form-actions form-actions">
                <button
                  className="supplier-button supplier-button-primary"
                  type="submit"
                  disabled={loading || provinces.length === 0}
                >
                  {loading
                    ? "Saving..."
                    : editingId
                      ? "Update Supplier"
                      : "Save Supplier"}
                </button>

                <button
                  className="supplier-button supplier-button-secondary"
                  type="button"
                  onClick={closeForm}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </Modal>
      )}
    </main>
  );
}
