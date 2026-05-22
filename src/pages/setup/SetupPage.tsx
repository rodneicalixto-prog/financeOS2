import { useEffect } from 'react'
import { setupConfig } from '../../../setup.config'
import { useWizardState } from './hooks/useWizardState'
import { Step1Welcome } from './steps/Step1Welcome'
import { Step2CoreCreds } from './steps/Step2CoreCreds'
import { Step3Bootstrap } from './steps/Step3Bootstrap'
import { Step4AppCreds } from './steps/Step4AppCreds'

export function SetupPage() {
  const { state, setCore, setAppCred, setOwner, goToStep, reset } = useWizardState()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === '1') {
      reset()
      window.history.replaceState({}, '', '/setup')
    }
  }, [reset])

  function handleStep4Complete() {
    try {
      localStorage.removeItem('agentise.setup.state')
    } catch {
      /* ignore */
    }
    window.location.href = setupConfig.postBootstrapRedirect
  }

  switch (state.currentStep) {
    case 1:
      return <Step1Welcome onNext={() => goToStep(2)} />
    case 2:
      return (
        <Step2CoreCreds
          core={state.core}
          owner={state.owner}
          onCoreChange={setCore}
          onOwnerChange={setOwner}
          onNext={() => goToStep(3)}
          onBack={() => goToStep(1)}
        />
      )
    case 3:
      return (
        <Step3Bootstrap
          core={state.core}
          owner={state.owner}
          onComplete={() => goToStep(4)}
          onBack={() => goToStep(2)}
        />
      )
    case 4:
      return (
        <Step4AppCreds
          appCreds={state.appCreds}
          onChange={setAppCred}
          onNext={handleStep4Complete}
          onBack={() => goToStep(3)}
        />
      )
    default:
      goToStep(1)
      return null
  }
}
