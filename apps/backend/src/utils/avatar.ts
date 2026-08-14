import { randomUUID } from "node:crypto"

import { Avatar, Style } from "@dicebear/core"
import glyphsStyleDefinition from "@dicebear/styles/glyphs.json" with { type: "json" }

const profileAvatarStyle = new Style(glyphsStyleDefinition)
const profileImageStyle = "glyphs"

export function createProfileImage(seed = randomUUID()) {
  return {
    profileImageSeed: seed,
    profileImageStyle,
  }
}

export function renderProfileImageSvg(seed: string) {
  const avatar = new Avatar(profileAvatarStyle, {
    seed,
    size: 128,
    borderRadius: 50,
  })

  return avatar.toString()
}
