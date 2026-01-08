import { useRef, useState } from 'react'

interface FileUploadProps {
    onFileSelect: (file: File) => void
    accept?: string
    label?: string
    descripcion?: string
    loading?: boolean
    disabled?: boolean
}

export default function FileUpload({
    onFileSelect,
    accept = '.csv',
    label = 'Subir archivo',
    descripcion = 'Arrastra un archivo o haz clic para seleccionar',
    loading = false,
    disabled = false
}: FileUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [arrastrando, setArrastrando] = useState(false)

    const handleClick = () => {
        if (!disabled && !loading) {
            inputRef.current?.click()
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            onFileSelect(file)
            // Reset input para permitir subir el mismo archivo
            e.target.value = ''
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        if (!disabled && !loading) {
            setArrastrando(true)
        }
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setArrastrando(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setArrastrando(false)

        if (disabled || loading) return

        const file = e.dataTransfer.files?.[0]
        if (file) {
            onFileSelect(file)
        }
    }

    return (
        <div>
            {label && (
                <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
            )}

            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${arrastrando
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                    }
          ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleChange}
                    className="hidden"
                    disabled={disabled || loading}
                />

                {loading ? (
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="text-sm text-gray-500">Procesando...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <svg
                            className="w-10 h-10 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                        </svg>
                        <p className="text-sm text-gray-600">{descripcion}</p>
                        <p className="text-xs text-gray-400">Formato: {accept}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
