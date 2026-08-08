import { IsString } from "class-validator"

export class LookupIdentifierDto {
  @IsString()
  identifier!: string
}
