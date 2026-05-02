export default function DateInput({ value, onChange, id = "report-date" }) {
  return (
    <div className="date-input-wrap w-full sm:w-auto">
      <label htmlFor={id}>Tanggal laporan</label>
      <input
        type="date"
        id={id}
        className="w-full sm:min-w-40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
