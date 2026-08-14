import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { renderProfileImageSvg } from "../../utils/avatar.js"

const avatarParamsSchema = z.object({
  seed: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9._:-]+$/, "Invalid avatar seed."),
})

export async function registerAvatarRoutes(app: FastifyInstance) {
  app.get("/avatars/profile/:seed.svg", async (request, reply) => {
    const params = avatarParamsSchema.parse(request.params)
    const svg = renderProfileImageSvg(params.seed)

    return reply
      .type("image/svg+xml; charset=utf-8")
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(svg)
  })
}
