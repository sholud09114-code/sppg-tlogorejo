import ActionIconButton from "./ActionIconButton.jsx";

export default function BeneficiaryGroupTable({
  groups,
  loading,
  onEdit,
  onDelete,
  canManage = true,
}) {
  if (loading) {
    return <div className="loading">Memuat data kelompok...</div>;
  }

  if (!groups.length) {
    return (
      <div className="empty-state rounded-2xl px-4 py-8">
        Belum ada data kelompok penerima manfaat.
      </div>
    );
  }

  return (
    <>
      <div className="mobile-data-list">
        {groups.map((group, index) => (
          <article className="mobile-data-card" key={group.id}>
            <div className="mobile-data-card-head">
              <div>
                <div className="mobile-data-card-title">{group.group_name}</div>
                <div className="mobile-data-card-subtitle">{group.group_type}</div>
              </div>
              <span className="table-index-badge">{index + 1}</span>
            </div>
            <div className="mobile-metric-grid">
              <div className="mobile-metric mobile-metric-emphasis">
                <span>Total porsi</span>
                <strong>{Number(group.total_portion).toLocaleString("id-ID")}</strong>
              </div>
              <div className="mobile-metric">
                <span>Siswa kecil</span>
                <strong>{Number(group.student_small_portion).toLocaleString("id-ID")}</strong>
              </div>
              <div className="mobile-metric">
                <span>Siswa besar</span>
                <strong>{Number(group.student_large_portion).toLocaleString("id-ID")}</strong>
              </div>
              <div className="mobile-metric">
                <span>Guru kecil</span>
                <strong>{Number(group.staff_small_portion).toLocaleString("id-ID")}</strong>
              </div>
              <div className="mobile-metric">
                <span>Guru besar</span>
                <strong>{Number(group.staff_large_portion).toLocaleString("id-ID")}</strong>
              </div>
            </div>
            {canManage ? (
              <div className="table-actions mobile-table-actions">
                <ActionIconButton action="edit" label="Edit" onClick={() => onEdit(group)} />
                <ActionIconButton action="delete" label="Hapus" onClick={() => onDelete(group)} />
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="data-table-scroll-shell scroll-affordance desktop-data-table" data-scroll-hint="Geser tabel">
        <div className="table-wrap overflow-x-auto rounded-2xl">
          <table className="data-table beneficiary-group-table min-w-[1320px]">
            <thead>
              <tr>
                <th className="col-no text-center">No</th>
                <th className="col-type text-left">Jenis Kelompok</th>
                <th className="col-name text-left">Nama Kelompok</th>
                <th className="col-portion text-right">Total Porsi</th>
                <th className="col-portion text-right">Porsi Siswa Kecil</th>
                <th className="col-portion text-right">Porsi Siswa Besar</th>
                <th className="col-portion text-right">Porsi Guru/Tendik Kecil</th>
                <th className="col-portion text-right">Porsi Guru/Tendik Besar</th>
                {canManage ? <th className="col-actions text-center">Aksi</th> : null}
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => (
                <tr key={group.id}>
                  <td className="col-no text-center">
                    <span className="table-index-badge">{index + 1}</span>
                  </td>
                  <td className="col-type text-left">{group.group_type}</td>
                  <td className="col-name text-left">{group.group_name}</td>
                  <td className="col-portion text-right">{Number(group.total_portion).toLocaleString("id-ID")}</td>
                  <td className="col-portion text-right">{Number(group.student_small_portion).toLocaleString("id-ID")}</td>
                  <td className="col-portion text-right">{Number(group.student_large_portion).toLocaleString("id-ID")}</td>
                  <td className="col-portion text-right">{Number(group.staff_small_portion).toLocaleString("id-ID")}</td>
                  <td className="col-portion text-right">{Number(group.staff_large_portion).toLocaleString("id-ID")}</td>
                  {canManage ? (
                    <td className="col-actions text-center">
                      <div className="table-actions">
                        <ActionIconButton action="edit" label="Edit" onClick={() => onEdit(group)} />
                        <ActionIconButton action="delete" label="Hapus" onClick={() => onDelete(group)} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
