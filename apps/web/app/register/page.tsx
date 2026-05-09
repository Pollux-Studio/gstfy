import Link from "next/link"

import { Button } from "@/components/ui/button"
import { FieldDescription, FieldGroup } from "@/components/ui/field"

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-[22rem] sm:max-w-sm">
        <FieldGroup>
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-xl font-bold">Create your GSTFY account</h1>
            <FieldDescription>
              Registration UI will be added next. This route is ready so users
              coming from login have a valid place to continue.
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
