import QRCode from "qrcode"

export async function createSignedQrDataUrl(signedQrCode: string | null | undefined) {
  if (!signedQrCode) {
    return null
  }

  return QRCode.toDataURL(signedQrCode, {
    width: 420,
    margin: 4,
    errorCorrectionLevel: "L",
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  })
}
