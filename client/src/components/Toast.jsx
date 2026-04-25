export default function Toast({ kind, message }) {
  if (!message) return null;
  return (
    <div className={`toast mt-4 rounded-xl px-4 py-3 text-sm ${kind || "info"}`}>
      {message}
    </div>
  );
}
