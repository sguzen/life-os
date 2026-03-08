// Running main page — redirected to Athletics (unified module)
// Individual activity pages at /running/[id] are unaffected.
import { redirect } from 'next/navigation'

export default function RunningPage() {
  redirect('/athletics')
}
