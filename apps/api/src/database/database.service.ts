import { Injectable, OnModuleDestroy } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import postgres, { type Sql } from "postgres"

import type { AppEnv } from "../config/env.js"

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly sql: Sql

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    this.sql = postgres(this.configService.get("DATABASE_URL", { infer: true }), {
      prepare: false,
      max: 5,
    })
  }

  async onModuleDestroy() {
    await this.sql.end()
  }
}
