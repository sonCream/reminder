import { AuthGate } from './_components/AuthGate'
import { ReminderApp } from './_components/ReminderApp'

export default function Page() {
  return (
    <AuthGate>
      <ReminderApp />
    </AuthGate>
  )
}
