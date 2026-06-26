import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function ShiftControls(): JSX.Element {
  const [isAdmin, setIsAdmin] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePinSubmit = () => {
    if (pin === '1234') {
      setIsAdmin(true)
      setError(null)
    } else {
      setError('PIN incorrecto')
    }
  }

  const openShift = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/shifts/open`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message || 'No se pudo abrir el turno')
      } else {
        setError(null)
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const closeShift = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/shifts/close`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message || 'No se pudo cerrar el turno')
      } else {
        setError(null)
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-gray-800 p-4">
        <h2 className="text-lg font-bold text-white">Control de Turno</h2>
        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN Admin"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="h-12 rounded-lg bg-gray-700 px-4 text-center text-white outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handlePinSubmit}
          className="h-12 rounded-lg bg-blue-600 px-4 font-bold text-white active:bg-blue-700"
        >
          Ingresar
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-gray-800 p-4">
      <h2 className="text-lg font-bold text-white">Control de Turno</h2>
      <div className="flex gap-2">
        <button
          onClick={openShift}
          disabled={loading}
          className="h-12 flex-1 rounded-lg bg-green-600 px-4 font-bold text-white active:bg-green-700 disabled:opacity-50"
        >
          Abrir Turno
        </button>
        <button
          onClick={closeShift}
          disabled={loading}
          className="h-12 flex-1 rounded-lg bg-red-600 px-4 font-bold text-white active:bg-red-700 disabled:opacity-50"
        >
          Cerrar Turno
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
