import { ImageResponse } from "next/og"

import { Simple } from "@/components/og/simple"

export const alt = "GSTFY - GST billing made simple"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <Simple
        label="GST billing"
        title="Billing, products, stock, and payments"
        description="A GST-ready workspace for sales bills, product masters, purchases, inventory, and dues."
        brand="GSTFY"
      />
    ),
    size
  )
}
