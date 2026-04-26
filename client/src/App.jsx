import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import Header from "./components/Header.jsx";
import Navigation from "./components/Navigation.jsx";
import Toast from "./components/Toast.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "./components/ui/appIcons.jsx";
import BeneficiaryGroups from "./pages/BeneficiaryGroups.jsx";
import DailyReport from "./pages/DailyReport.jsx";
import FoodWaste from "./pages/FoodWaste.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import MenuReports from "./pages/MenuReports.jsx";
import PriceMonitoring from "./pages/PriceMonitoring.jsx";
import ShoppingReports from "./pages/ShoppingReports.jsx";
import WeeklyReports from "./pages/WeeklyReports.jsx";

const PAGE_ROUTES = {
  home: "/",
  daily: "/daily",
  "menu-reports": "/menu-reports",
  "shopping-reports": "/shopping-reports",
  "food-waste": "/food-waste",
  "price-monitoring": "/price-monitoring",
  weekly: "/weekly",
  "beneficiary-groups": "/beneficiary-groups",
};

const ROUTE_PAGES = Object.fromEntries(
  Object.entries(PAGE_ROUTES).map(([page, path]) => [path, page])
);

function getPageFromLocation() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return ROUTE_PAGES[path] || "home";
}

export default function App() {
  const [activePage, setActivePage] = useState(getPageFromLocation);
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    const handlePopState = () => setActivePage(getPageFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToPage = useCallback((page) => {
    const nextPage = PAGE_ROUTES[page] ? page : "home";
    const nextPath = PAGE_ROUTES[nextPage];
    setActivePage(nextPage);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }, []);

  if (loading) {
    return <div className="auth-loading">Memuat sesi...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Header />
        <div className="app-topbar-divider" aria-hidden="true" />
        <Navigation active={activePage} onChange={navigateToPage} />
        <div className="app-sidebar-account" aria-label="Profil pengguna">
          <div className="app-sidebar-account-icon">
            <AppIcon name="user" size={24} weight={APP_ICON_WEIGHT.summary} />
          </div>
          <div className="app-sidebar-account-copy">
            <strong>{user.name}</strong>
            <span>{user.role === "admin" ? "Administrator" : "Publik - lihat saja"}</span>
          </div>
          <button type="button" className="app-sidebar-logout" onClick={logout} aria-label="Logout">
            <AppIcon name="logout" size={18} weight={APP_ICON_WEIGHT.action} />
          </button>
        </div>
      </aside>

      <main className="container app-content">
        {activePage === "home" ? (
          <Home onNavigate={navigateToPage} />
        ) : activePage === "daily" ? (
          <DailyReport />
        ) : activePage === "menu-reports" ? (
          <MenuReports />
        ) : activePage === "shopping-reports" ? (
          <ShoppingReports />
        ) : activePage === "food-waste" ? (
          <FoodWaste />
        ) : activePage === "price-monitoring" ? (
          <PriceMonitoring />
        ) : activePage === "weekly" ? (
          <WeeklyReports />
        ) : activePage === "beneficiary-groups" ? (
          <BeneficiaryGroups />
        ) : (
          <Toast kind="info" message="Menu ini belum tersedia." />
        )}
      </main>
    </div>
  );
}
