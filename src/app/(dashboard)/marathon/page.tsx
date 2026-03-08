// Marathon main page — redirected to Athletics (unified module)
import { redirect } from 'next/navigation'

export default function MarathonPage() {
  redirect('/athletics')
}
