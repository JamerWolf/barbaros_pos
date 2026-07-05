interface ToastProps {
  message: string
  type: 'success' | 'error'
}

export function Toast({ message, type }: ToastProps): JSX.Element {
  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 rounded-xl p-4 text-center font-bold text-white shadow-xl ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  )
}
