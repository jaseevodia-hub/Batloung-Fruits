import Orders from "./Orders";
import Reports from "./pages/Reports";
import Fruits from "./pages/Fruits";
import Suppliers from "./pages/Suppliers";
import Vendors from "./pages/Vendors";
import Stock from "./pages/Stock";
import Login from "./pages/Login";
import Users from "./pages/Users";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import { getToken, isAdmin } from "./api";
import "./App.css";

function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return isAdmin() ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="fruits" element={<Fruits />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="stock" element={<Stock />} />
          <Route path="orders" element={<Orders />} />
          <Route path="reports" element={<Reports />} />
          <Route
            path="users"
            element={
              <RequireAdmin>
                <Users />
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
