import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field"

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <FieldGroup>
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-xl font-bold">Forgot password</h1>
            <FieldDescription>
              This recovery step is UI-only for now. Backend reset wiring can be
              added later.
            </FieldDescription>
          </div>
          <Button className="w-full" render={<Link href="/login" />}>
            Back to login
          </Button>
        </FieldGroup>
      </div>
    </div>
  )
}
