import { useRef, useState } from 'react'

interface UploadDropzoneProps {
  file: File | null
  disabled?: boolean
  onFileChange: (file: File | null) => void
}

const MAX_FILE_BYTES = 5 * 1024 * 1024

function validarArquivo(file: File) {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return 'Envie um arquivo .xlsx, .xls ou .csv.'
  if (file.size > MAX_FILE_BYTES) return 'Envie um arquivo de até 5 MB.'
  return ''
}

export function UploadDropzone({ file, disabled, onFileChange }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  function selectFile(selected: File | undefined) {
    setError('')
    if (!selected) {
      onFileChange(null)
      return
    }
    const validation = validarArquivo(selected)
    if (validation) {
      setError(validation)
      onFileChange(null)
      return
    }
    onFileChange(selected)
  }

  return (
    <div className="upload-dropzone-wrap">
      <button
        type="button"
        className={dragging ? 'upload-dropzone upload-dropzone-active' : 'upload-dropzone'}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          selectFile(event.dataTransfer.files[0])
        }}
      >
        <span className="upload-icon" aria-hidden="true">⇧</span>
        <strong>{file ? file.name : 'Selecionar planilha de férias'}</strong>
        <small>{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Arraste o arquivo aqui ou clique para escolher'}</small>
      </button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".xlsx,.xls,.csv"
        disabled={disabled}
        onChange={(event) => selectFile(event.target.files?.[0])}
      />
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </div>
  )
}
