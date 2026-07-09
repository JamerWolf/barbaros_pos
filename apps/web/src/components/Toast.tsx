interface ToastProps {
  message: string
  type: 'success' | 'error'
}

export function Toast({ message, type }: ToastProps): JSX.Element {
  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 rounded-xl p-4 text-center font-bold text-[#0A0A0A] shadow-xl ${
        type === 'success' ? 'bg-[#7CCD7C]' : 'bg-[#E85050]'
      }`}
    >
      {message}
    </div>
  )
}
