import { useState } from 'react'
import API_URL from '../../utils/apiUrl.js'
import { tw } from '../../utils/colors.js'

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
      <div className="flex flex-col gap-3 rounded-xl bg-[#141414] p-4">
        <h2 className="text-lg font-bold text-[#E8E0D0]">Control de Turno</h2>
        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN Admin"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="h-12 rounded-lg bg-[#1E1E1E] px-4 text-center text-[#E8E0D0] outline-none focus:ring-2 focus:ring-[#C8A84E]"
        />
        <button
          onClick={handlePinSubmit}
          className="h-12 rounded-lg bg-[#141414] border border-[#C8A84E]/30 px-4 font-bold text-[#C8A84E] active:bg-[#1E1E1E]"
        >
          Ingresar
        </button>
        {error && <p className={`text-sm ${tw.error}`}>{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[#141414] p-4">
      <h2 className="text-lg font-bold text-[#E8E0D0]">Control de Turno</h2>
      <div className="flex gap-2">
        <button
          onClick={openShift}
          disabled={loading}
          className="h-12 flex-1 rounded-lg bg-[#2D5A27] px-4 font-bold text-[#7CCD7C] active:bg-[#2D5A27]/80 disabled:opacity-50"
        >
          Abrir Turno
        </button>
        <button
          onClick={closeShift}
          disabled={loading}
          className="h-12 flex-1 rounded-lg bg-[#5C1A1A] px-4 font-bold text-[#E85050] active:bg-[#5C1A1A]/80 disabled:opacity-50"
        >
          Cerrar Turno
        </button>
      </div>
      {error && <p className={`text-sm ${tw.error}`}>{error}</p>}
    </div>
  )
}
