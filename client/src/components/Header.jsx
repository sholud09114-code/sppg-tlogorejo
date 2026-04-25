import brandMark from "../assets/bgn-logo-color.png";

function BrandIcon() {
  return (
    <div className="brand-icon-shell" aria-hidden="true">
      <img
        src={brandMark}
        alt="Logo Badan Gizi Nasional"
        className="brand-icon"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

export default function Header() {
  return (
    <header className="app-header">
      <BrandIcon />
      <div className="app-header-copy">
        <h1>SPPG Tlogorejo</h1>
        <p>Sistem pelaporan operasional penerima manfaat harian</p>
      </div>
    </header>
  );
}
