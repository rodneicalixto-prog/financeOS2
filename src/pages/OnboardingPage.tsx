import { DollarSign } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper'
import { StepGmail } from '@/components/onboarding/StepGmail'
import { StepBanks } from '@/components/onboarding/StepBanks'
import { StepImport } from '@/components/onboarding/StepImport'
import { StepDone } from '@/components/onboarding/StepDone'
import { useOnboarding } from '@/hooks/useOnboarding'

export function OnboardingPage() {
  const { step, nextStep, prevStep, completeOnboarding } = useOnboarding()

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue/20 mb-2">
            <DollarSign className="h-6 w-6 text-accent-blue" />
          </div>
          <h1 className="text-xl font-bold text-white">FinanceOS</h1>
        </div>

        {/* Stepper */}
        <OnboardingStepper currentStep={step} />

        {/* Step Content */}
        <Card padding="lg">
          {step === 1 && <StepGmail onNext={nextStep} />}
          {step === 2 && <StepBanks onNext={nextStep} onBack={prevStep} />}
          {step === 3 && <StepImport onNext={nextStep} onBack={prevStep} />}
          {step === 4 && <StepDone onComplete={completeOnboarding} />}
        </Card>
      </div>
    </div>
  )
}
