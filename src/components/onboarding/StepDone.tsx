import { useNavigate } from 'react-router-dom'
import { PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface StepDoneProps {
  onComplete: () => void
}

export function StepDone({ onComplete }: StepDoneProps) {
  const navigate = useNavigate()

  function handleFinish() {
    onComplete()
    navigate('/')
  }

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-green/20">
          <PartyPopper className="h-10 w-10 text-accent-green" />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white">Tudo pronto!</h2>
        <p className="mt-2 text-sm text-slate-400">
          Sua conta está configurada. Acesse o dashboard para visualizar suas finanças.
        </p>
      </div>

      <div className="space-y-3">
        <Button onClick={handleFinish} size="lg" className="w-full">
          Ir para o Dashboard
        </Button>
      </div>
    </div>
  )
}
