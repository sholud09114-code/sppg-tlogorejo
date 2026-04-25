export default function DateInput({ value, onChange }) {
  return (
    <div className="date-input-wrap w-full sm:w-auto">
      <label htmlFor="report-date">Tanggal laporan</label>
      <input
        type="date"
        id="report-date"
        className="w-full sm:min-w-40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
