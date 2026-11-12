import { useEffect, useMemo, useState } from "react";
import { apiFetch, getUser, API_URL } from "../api";
import useTableFilter from "../hooks/useTableFilter";
import { TableFilter } from "../components/TableFilter";
import Modal from "../components/Modal";
import { DeleteIcon, EditIcon } from "../components/ActionIcons";


const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  role: "sales",
  is_active: true,
};

const userFilterColumns = [
  { key: "full_name", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "status_label", label: "Status" },
];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const filterableUsers = useMemo(
    () =>
      users.map((user) => ({
        ...user,
        status_label:
          user.is_active === 1 || user.is_active === true
            ? "Active"
            : "Inactive",
      })),
    [users]
  );
  const userFilter = useTableFilter(filterableUsers);

  const currentUser = getUser();

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
      const response = await apiFetch(`${API_URL}/users`);
      const data = await readResponse(response);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load users.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowPassword(false);
  }

  function openCreate() {
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

    if (!editingId && !form.password) {
      setError("A password is required for a new user.");
      return;
    }

    setLoading(true);

    try {
      const url = editingId
        ? `${API_URL}/users/${editingId}`
        : `${API_URL}/users`;

      const payload = {
        full_name: form.full_name,
        email: form.email,
        role: form.role,
      };

      if (form.password) {
        payload.password = form.password;
      }

      if (editingId) {
        payload.is_active = form.is_active;
      }

      const response = await apiFetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await readResponse(response);

      setMessage(
        result.message ||
          (editingId
            ? "User updated successfully."
            : "User created successfully.")
      );

      resetForm();
      setFormOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save user.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(user) {
    setEditingId(user.id);
    setShowPassword(false);
    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      role: user.role === "administrator" ? "administrator" : "sales",
      is_active: user.is_active === 1 || user.is_active === true,
    });
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  async function handleDelete(user) {
    const confirmed = window.confirm(
      `Delete user "${user.full_name}" (${user.email})?`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");
    setDeletingId(user.id);

    try {
      const response = await apiFetch(`${API_URL}/users/${user.id}`, {
        method: "DELETE",
      });

      const result = await readResponse(response);

      setMessage(result.message || "User deleted successfully.");

      if (editingId === user.id) {
        resetForm();
        setFormOpen(false);
      }

      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete user.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="management-page">
      <header className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Create user accounts and manage roles and access.</p>
        </div>

        <div className="header-actions">
          <button type="button" className="primary-button" onClick={openCreate}>
            + Create User
          </button>

          <div className="management-toolbar">
            <span>Total users: {users.length}</span>
          </div>
        </div>
      </header>

      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {formOpen && (
        <Modal
          title={editingId ? "Edit User" : "Create User"}
          subtitle="Manage account details, roles and access."
          onClose={closeForm}
          size="large"
        >
      <form className="management-form" onSubmit={handleSubmit}>
        <div className="product-form-grid">
          <label>
            Full Name *
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Enter full name"
              required
            />
          </label>

          <label>
            Email *
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter email address"
              required
            />
          </label>

          <label>
            Password {editingId ? "(leave blank to keep current)" : "*"}
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              placeholder={
                editingId ? "New password (optional)" : "Enter password"
              }
              required={!editingId}
              autoComplete="new-password"
            />
            <span className="show-password">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
              />
              Show password
            </span>
          </label>

          <label>
            Role *
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              required
            >
              <option value="sales">Sales</option>
              <option value="administrator">Administrator</option>
            </select>
          </label>

          {editingId && (
            <label>
              Account Active
              <span className="show-password">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                />
                Allow this user to log in
              </span>
            </label>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : editingId
                ? "Update User"
                : "Create User"}
          </button>

          <button type="button" onClick={closeForm} disabled={loading}>
            {editingId ? "Cancel Edit" : "Cancel"}
          </button>
        </div>
      </form>
        </Modal>
      )}

      <section className="management-section">
        <div className="table-search-controls">
          <TableFilter
            columns={userFilterColumns}
            rows={filterableUsers}
            filterKey={userFilter.filterKey}
            filterValue={userFilter.filterValue}
            onChange={userFilter.changeFilter}
            onClear={userFilter.clearFilter}
          />
        </div>

        {dataLoading && users.length === 0 ? (
          <p>Loading users...</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {userFilter.filteredRows.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      {user.is_active === 1 || user.is_active === true
                        ? "Active"
                        : "Inactive"}
                    </td>
                    <td>
                      <div className="form-actions">
                        <button
                          type="button"
                          className="edit-button"
                          title="Edit"
                          aria-label="Edit"
                          onClick={() => handleEdit(user)}
                        >
                          <EditIcon />
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDelete(user)}
                          disabled={
                            deletingId === user.id ||
                            currentUser?.id === user.id
                          }
                          title={
                            currentUser?.id === user.id
                              ? "You cannot delete your own account."
                              : deletingId === user.id
                                ? "Deleting..."
                                : "Delete"
                          }
                          aria-label={
                            deletingId === user.id ? "Deleting..." : "Delete"
                          }
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {userFilter.filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      {dataLoading
                        ? "Loading users..."
                        : users.length === 0
                          ? "No users found."
                          : "No users match your filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
