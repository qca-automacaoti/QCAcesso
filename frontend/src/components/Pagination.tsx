interface PaginationProps {
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  label: string
}

export function Pagination({ page, total, pageSize, onPageChange, label }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const firstPage = Math.max(0, Math.min(page - 2, totalPages - 5))
  const lastPage = Math.min(totalPages, firstPage + 5)
  const pages = Array.from({ length: lastPage - firstPage }, (_, index) => firstPage + index)

  return (
    <div className="checklist-pagination" aria-label={label}>
      <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}</span>
      <div className="pagination-controls">
        <button className="button button-secondary" onClick={() => onPageChange(page - 1)} disabled={page === 0}>Anterior</button>
        <div className="pagination-pages" role="tablist" aria-label="Páginas">
          {pages.map((pageNumber) => <button
            className={pageNumber === page ? 'pagination-page pagination-page-active' : 'pagination-page'}
            key={pageNumber}
            role="tab"
            aria-selected={pageNumber === page}
            onClick={() => onPageChange(pageNumber)}
          >{pageNumber + 1}</button>)}
        </div>
        <button className="button button-secondary" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}>Próxima</button>
      </div>
    </div>
  )
}
