import Image from "next/image"
import { GalleryVerticalEndIcon } from "lucide-react"

import { AuthSystemControls } from "@/components/auth-system-controls"
import { SignupForm } from "@/components/signup-form"
import { redirectAuthenticatedUser } from "@/lib/auth/server"

export default async function SignupPage() {
  await redirectAuthenticatedUser()

  return (
    <div className="grid h-svh w-full overflow-hidden lg:grid-cols-2">
      <div className="flex h-full min-h-0 flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEndIcon className="size-4" />
            </div>
            Gstfy
          </a>
          <AuthSystemControls />
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 w-full pt-6">
            <SignupForm />
          </div>
        </div>
      </div>
      <div className="relative hidden h-full min-h-0 bg-muted lg:block">
        <Image
          src="/placeholder.svg"
          alt="Image"
          fill
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}
