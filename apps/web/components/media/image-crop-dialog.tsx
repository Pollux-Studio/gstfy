"use client"

import * as React from "react"
import {
  ImageIcon,
  MoveHorizontalIcon,
  MoveVerticalIcon,
  RotateCcwIcon,
  ScissorsIcon,
  ZoomInIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const previewMaxHeight = 260
const previewMaxWidth = 286
const defaultOutputSize = 512

export function ImageCropDialog({
  description = "Crop the image into a square before upload.",
  file,
  onCancel,
  onCrop,
  open,
  outputHeight,
  outputSize = defaultOutputSize,
  outputWidth,
  title = "Crop image",
}: {
  description?: string
  file: File
  onCancel: () => void
  onCrop: (file: File) => void
  open: boolean
  outputHeight?: number
  outputSize?: number
  outputWidth?: number
  title?: string
}) {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = React.useState("")
  const [zoom, setZoom] = React.useState(1)
  const [offsetX, setOffsetX] = React.useState(0)
  const [offsetY, setOffsetY] = React.useState(0)
  const [isCropping, setIsCropping] = React.useState(false)
  const [previewUrl] = React.useState(() => URL.createObjectURL(file))
  const outputDimensions = React.useMemo(
    () => ({
      height: outputHeight ?? outputSize,
      width: outputWidth ?? outputSize,
    }),
    [outputHeight, outputSize, outputWidth]
  )
  const previewDimensions = React.useMemo(
    () =>
      getBoundedDimensions({
        height: outputDimensions.height,
        maxHeight: previewMaxHeight,
        maxWidth: previewMaxWidth,
        width: outputDimensions.width,
      }),
    [outputDimensions]
  )

  function releasePreviewUrl() {
    URL.revokeObjectURL(previewUrl)
  }

  function handleCancel() {
    releasePreviewUrl()
    onCancel()
  }

  const cropBounds = React.useMemo(() => {
    if (!image) {
      return {
        displayHeight: previewDimensions.height,
        displayWidth: previewDimensions.width,
        maxOffsetX: 0,
        maxOffsetY: 0,
      }
    }

    const baseScale = Math.max(
      previewDimensions.width / image.naturalWidth,
      previewDimensions.height / image.naturalHeight
    )
    const displayWidth = image.naturalWidth * baseScale * zoom
    const displayHeight = image.naturalHeight * baseScale * zoom

    return {
      displayHeight,
      displayWidth,
      maxOffsetX: Math.max(0, (displayWidth - previewDimensions.width) / 2),
      maxOffsetY: Math.max(0, (displayHeight - previewDimensions.height) / 2),
    }
  }, [image, previewDimensions, zoom])

  function resetCrop() {
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
  }

  async function cropImage() {
    if (!image || loadError) {
      return
    }

    setIsCropping(true)

    try {
      const canvas = document.createElement("canvas")
      canvas.width = outputDimensions.width
      canvas.height = outputDimensions.height
      const context = canvas.getContext("2d")

      if (!context) {
        throw new Error("Unable to prepare image crop.")
      }

      const baseScale = Math.max(
        outputDimensions.width / image.naturalWidth,
        outputDimensions.height / image.naturalHeight
      )
      const scale = baseScale * zoom
      const drawWidth = image.naturalWidth * scale
      const drawHeight = image.naturalHeight * scale
      const previewToOutputRatioX = outputDimensions.width / previewDimensions.width
      const previewToOutputRatioY = outputDimensions.height / previewDimensions.height
      const drawX =
        (outputDimensions.width - drawWidth) / 2 + offsetX * previewToOutputRatioX
      const drawY =
        (outputDimensions.height - drawHeight) / 2 + offsetY * previewToOutputRatioY

      context.clearRect(0, 0, outputDimensions.width, outputDimensions.height)
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (nextBlob) => {
            if (!nextBlob) {
              reject(new Error("Unable to export cropped image."))
              return
            }

            resolve(nextBlob)
          },
          "image/webp",
          0.9
        )
      })
      const croppedName = createCroppedFileName(file.name)

      onCrop(
        new File([blob], croppedName, {
          lastModified: Date.now(),
          type: "image/webp",
        })
      )
      releasePreviewUrl()
    } finally {
      setIsCropping(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleCancel()}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 px-5 py-5 sm:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div
              className={cn(
                "relative mx-auto overflow-hidden rounded-2xl border border-border bg-muted/40",
                loadError && "flex items-center justify-center"
              )}
              style={{
                height: previewDimensions.height,
                width: previewDimensions.width,
              }}
            >
              {loadError ? (
                <div className="grid place-items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  <ImageIcon className="size-7" />
                  <p>{loadError}</p>
                </div>
              ) : (
                previewUrl ?
                  <div
                    aria-label="Logo crop preview"
                    className="absolute inset-0 rounded-[inherit]"
                    role="img"
                    style={{
                      backgroundImage: `url(${previewUrl})`,
                      backgroundPosition: `calc(50% + ${offsetX}px) calc(50% + ${offsetY}px)`,
                      backgroundRepeat: "no-repeat",
                      backgroundSize: `${cropBounds.displayWidth}px ${cropBounds.displayHeight}px`,
                    }}
                  />
                : <div className="grid size-full place-items-center text-muted-foreground">
                    <ImageIcon className="size-7" />
                  </div>
              )}
              {/* Canvas export uses the loaded native image element. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="sr-only"
                src={previewUrl}
                onError={() => {
                  setLoadError("Unable to read this image. Try another JPG, PNG, or WebP file.")
                }}
                onLoad={(event) => {
                  setImage(event.currentTarget)
                  setLoadError("")
                }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10" />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Final logo: {outputDimensions.width} x {outputDimensions.height}px WebP.
            </p>
          </div>

          <div className="space-y-4">
            <CropRange
              disabled={!image || Boolean(loadError)}
              icon={<ZoomInIcon />}
              label="Zoom"
              max={3}
              min={1}
              step={0.01}
              value={zoom}
              onChange={setZoom}
            />
            <CropRange
              disabled={!image || cropBounds.maxOffsetX === 0 || Boolean(loadError)}
              icon={<MoveHorizontalIcon />}
              label="Move left / right"
              max={cropBounds.maxOffsetX}
              min={-cropBounds.maxOffsetX}
              step={1}
              value={clamp(offsetX, -cropBounds.maxOffsetX, cropBounds.maxOffsetX)}
              onChange={setOffsetX}
            />
            <CropRange
              disabled={!image || cropBounds.maxOffsetY === 0 || Boolean(loadError)}
              icon={<MoveVerticalIcon />}
              label="Move up / down"
              max={cropBounds.maxOffsetY}
              min={-cropBounds.maxOffsetY}
              step={1}
              value={clamp(offsetY, -cropBounds.maxOffsetY, cropBounds.maxOffsetY)}
              onChange={setOffsetY}
            />
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-2 text-xs"
              onClick={resetCrop}
            >
              <RotateCcwIcon className="size-3.5" />
              Reset crop
            </Button>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
            disabled={!image || Boolean(loadError) || isCropping}
            onClick={() => void cropImage()}
          >
            {isCropping ? <Spinner /> : <ScissorsIcon className="size-4" />}
            {isCropping ? "" : "Crop & upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CropRange({
  disabled,
  icon,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  disabled: boolean
  icon: React.ReactNode
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  value: number
}) {
  return (
    <Field>
      <FieldLabel className="flex items-center gap-2">
        <span className="text-muted-foreground [&_svg]:size-3.5">{icon}</span>
        {label}
      </FieldLabel>
      <Input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        className="h-8 px-0"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <FieldDescription>
        {disabled ? "No adjustment needed for this image." : "Fine tune before upload."}
      </FieldDescription>
    </Field>
  )
}

function getBoundedDimensions({
  height,
  maxHeight,
  maxWidth,
  width,
}: {
  height: number
  maxHeight: number
  maxWidth: number
  width: number
}) {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1)

  return {
    height: Math.max(80, Math.round(height * scale)),
    width: Math.max(80, Math.round(width * scale)),
  }
}

function createCroppedFileName(fileName: string) {
  const safeName = fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

  return `${safeName || "business-logo"}-cropped.webp`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
