import { useMemo, useState } from "react";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

const DESKTOP_TABS = [
  { id: "home", label: "Beranda", shortLabel: "Beranda", icon: "home" },
  { id: "daily", label: "Laporan Harian", shortLabel: "Harian", icon: "daily" },
  { id: "menu-reports", label: "Laporan Menu", shortLabel: "Menu", icon: "menuReports" },
  { id: "shopping-reports", label: "Laporan Belanja", shortLabel: "Belanja", icon: "shoppingReports" },
  { id: "food-waste", label: "Sisa Pangan", shortLabel: "Sisa", icon: "foodWaste" },
  { id: "price-monitoring", label: "Monitoring Harga", shortLabel: "Harga", icon: "priceMonitoring" },
  { id: "beneficiary-groups", label: "Data Kelompok", shortLabel: "Kelompok", icon: "beneficiaryGroups" },
  { id: "weekly", label: "Laporan Mingguan", shortLabel: "Mingguan", icon: "weekly" },
  { id: "docs", label: "Dokumentasi", shortLabel: "Docs", icon: "docs", disabled: true, badge: "Segera hadir" },
];

const MOBILE_PRIMARY_TABS = [
  { id: "home", label: "Beranda", icon: "home" },
  { id: "daily", label: "Harian", icon: "daily" },
  { id: "menu-reports", label: "Menu", icon: "menuReports" },
  { id: "food-waste", label: "Sisa", icon: "foodWaste" },
  { id: "more", label: "Lainnya", icon: "more" },
];

const MOBILE_SECONDARY_TABS = [
  { id: "shopping-reports", label: "Laporan Belanja", icon: "shoppingReports" },
  { id: "price-monitoring", label: "Monitoring Harga", icon: "priceMonitoring" },
  { id: "beneficiary-groups", label: "Data Kelompok", icon: "beneficiaryGroups" },
  { id: "weekly", label: "Laporan Mingguan", icon: "weekly" },
  { id: "docs", label: "Dokumentasi", icon: "docs", disabled: true, badge: "Segera hadir" },
];

function NavButton({ item, active, onPress, mobile = false }) {
  return (
    <button
      type="button"
      className={`nav-tab ${mobile ? "bottom-nav-tab" : ""} ${active ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
      onClick={() => {
        if (item.disabled) return;
        onPress(item.id);
      }}
      aria-current={active ? "page" : undefined}
      aria-disabled={item.disabled ? "true" : undefined}
      disabled={item.disabled}
    >
      <span className="nav-tab-icon-wrap">
        <AppIcon name={item.icon} size={mobile ? 20 : 22} weight={APP_ICON_WEIGHT.nav} />
      </span>
      <span className={`nav-tab-label ${mobile ? "bottom-nav-label" : "nav-tab-label-full"}`}>
        {item.label}
      </span>
      {!mobile ? <span className="nav-tab-label nav-tab-label-short">{item.shortLabel || item.label}</span> : null}
      {item.badge ? <span className={`nav-tab-badge ${mobile ? "bottom-nav-badge" : ""}`}>{item.badge}</span> : null}
    </button>
  );
}

export default function Navigation({ active, onChange }) {
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = useMemo(
    () => MOBILE_SECONDARY_TABS.some((item) => item.id === active),
    [active]
  );

  const changePage = (page) => {
    setMoreOpen(false);
    onChange(page);
  };

  return (
    <>
      <div className="desktop-nav-wrap nav-scroll-shell scroll-affordance" data-scroll-hint="Geser menu">
        <nav className="nav-tabs" aria-label="Navigasi utama desktop">
          {DESKTOP_TABS.map((tab) => (
            <NavButton
              key={tab.id}
              item={tab}
              active={active === tab.id}
              onPress={changePage}
            />
          ))}
        </nav>
      </div>

      <div className={`mobile-more-sheet ${moreOpen ? "open" : ""}`} aria-hidden={!moreOpen}>
        <div
          className={`mobile-more-backdrop ${moreOpen ? "open" : ""}`}
          onClick={() => setMoreOpen(false)}
        />
        <div className="mobile-more-panel" role="dialog" aria-modal="true" aria-label="Menu lainnya">
          <div className="mobile-more-head">
            <div>
              <strong>Menu lainnya</strong>
              <span>Akses fitur operasional tambahan.</span>
            </div>
            <button
              type="button"
              className="mobile-more-close"
              onClick={() => setMoreOpen(false)}
              aria-label="Tutup menu lainnya"
            >
              <AppIcon name="close" size={18} weight={APP_ICON_WEIGHT.action} />
            </button>
          </div>

          <div className="mobile-more-list">
            {MOBILE_SECONDARY_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mobile-more-item ${active === item.id ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
                onClick={() => {
                  if (item.disabled) return;
                  changePage(item.id);
                }}
                disabled={item.disabled}
              >
                <span className="mobile-more-item-icon">
                  <AppIcon name={item.icon} size={20} weight={APP_ICON_WEIGHT.nav} />
                </span>
                <span className="mobile-more-item-copy">
                  <span className="mobile-more-item-label">{item.label}</span>
                  {item.badge ? <span className="nav-tab-badge bottom-nav-badge">{item.badge}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <nav className="bottom-nav" aria-label="Navigasi utama mobile">
        {MOBILE_PRIMARY_TABS.map((item) => {
          const isActive = item.id === "more" ? moreActive || moreOpen : active === item.id;
          return (
            <NavButton
              key={item.id}
              item={item}
              mobile
              active={isActive}
              onPress={(id) => {
                if (id === "more") {
                  setMoreOpen((prev) => !prev);
                  return;
                }
                changePage(id);
              }}
            />
          );
        })}
      </nav>
    </>
  );
}
