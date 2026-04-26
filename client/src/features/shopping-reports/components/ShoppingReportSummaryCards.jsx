import { formatMoney } from "../../../shared/utils/formatters.js";

export default function ShoppingReportSummaryCards({
  dailyBudget,
  differenceAmount,
  totalSpending,
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="summary-card rounded-2xl p-4">
        <span className="summary-card-label">Total belanja</span>
        <strong>{formatMoney(totalSpending)}</strong>
      </div>
      <div className="summary-card rounded-2xl p-4">
        <span className="summary-card-label">Pagu harian</span>
        <strong>{formatMoney(dailyBudget)}</strong>
      </div>
      <div className="summary-card rounded-2xl p-4">
        <span className="summary-card-label">Selisih</span>
        <strong>{formatMoney(differenceAmount)}</strong>
      </div>
    </div>
  );
}
