import { Routes, Route, NavLink } from "react-router-dom";
import { ShopPage } from "./pages/ShopPage";
import { CartPage } from "./pages/CartPage";
import { ProductPage } from "./pages/ProductPage";
import { PublicItemPage } from "./pages/PublicItemPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminCreatePage } from "./pages/AdminCreatePage";

function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="logo-row">
        <h1>VTGSHMOT</h1>
        <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>мини-приложение</div>
      </div>
      <nav className="tabs">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Каталог
        </NavLink>
        <NavLink to="/cart" className={({ isActive }) => (isActive ? "active" : "")}>
          Корзина
        </NavLink>
      </nav>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ShopLayout>
            <ShopPage />
          </ShopLayout>
        }
      />
      <Route
        path="/cart"
        element={
          <ShopLayout>
            <CartPage />
          </ShopLayout>
        }
      />
      <Route path="/product/:id" element={<ProductPage />} />
      <Route path="/i/:code" element={<PublicItemPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/create" element={<AdminCreatePage />} />
    </Routes>
  );
}
