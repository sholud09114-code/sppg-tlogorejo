import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext.jsx";
import Header from "./components/Header.jsx";
import LoadingMessage from "./components/LoadingMessage.jsx";
import Navigation from "./components/Navigation.jsx";
import Toast from "./components/Toast.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "./components/ui/appIcons.jsx";
import Login from "./pages/Login.jsx";

const BeneficiaryGroups = lazy(() => import("./pages/BeneficiaryGroups.jsx"));
const DailyReport = lazy(() => import("./pages/DailyReport.jsx"));
const FoodWaste = lazy(() => import("./pages/FoodWaste.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const MenuReports = lazy(() => import("./pages/MenuReports.jsx"));
const PriceMonitoring = lazy(() => import("./pages/PriceMonitoring.jsx"));
const ShoppingReports = lazy(() => import("./pages/ShoppingReports.jsx"));
const WeeklyReports = lazy(() => import("./pages/WeeklyReports.jsx"));

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
    return <LoadingMessage className="auth-loading">Memuat sesi...</LoadingMessage>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Header />
        <div className="app-topbar-divider" aria-hidden="true" />
        <Navigation active={activePage} onChange={navigateToPage} user={user} onLogout={logout} />
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
        <Suspense fallback={<LoadingMessage>Memuat halaman...</LoadingMessage>}>
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
            <WeeklyReports onNavigate={navigateToPage} />
          ) : activePage === "beneficiary-groups" ? (
            <BeneficiaryGroups />
          ) : (
            <Toast kind="info" message="Menu ini belum tersedia." />
          )}
        </Suspense>
      </main>
    </div>
  );
}
