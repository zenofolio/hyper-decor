import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperService,
  HyperController,
  Get,
  Post,
  Res,
  Body,
  Response,
  OnInit,
  createApplication,
  Transform,
} from "../src";
import { getOpenAPI } from "../src/lib/openapi";
import { injectable } from "tsyringe";
import { request } from "./helpers/request";
import { TransformContext } from "../src/__internals/transform/transform.registry";

// 1. Setup a Mock Transformer (Zod-like)
const ZodTransformer = {
  // Runtime transformation logic
  transform: ({ data, schema, res, req }: TransformContext) => {
    if (schema && schema._type === "zod") {
      if (!data || !data.username) throw new Error("Username is required");
      return { ...data, parsed: true, timestamp: Date.now() };
    }
    return data;
  },
  getOpenApiSchema: (schema: any) => {
    if (schema._type === "zod") {
      return {
        type: "object",
        properties: {
          username: { type: "string" },
          parsed: { type: "boolean" },
          timestamp: { type: "number" }
        },
        required: ["username"]
      };
    }
  }
};

const mockSchema = { _type: "zod" };

// 2. Setup Services and Controllers
@injectable()
@HyperService()
class AnalyticsService implements OnInit {
  public initialized = false;
  async onInit() {
    this.initialized = true;
  }
  logAction(action: string) {
    // console.log(`Action logged: ${action}`);
  }
}

@HyperController("/api")
class MainController {
  constructor(private analytics: AnalyticsService) { }

  @Get("/status")
  status(@Res() res: Response) {
    res.json({ status: "alive", service: this.analytics.initialized });
  }

  @Post("/user")
  @Transform(mockSchema)
  createUser(@Body() data: any, @Res() res: Response) {
    console.log("-> Controller createUser hit with data:", data);
    this.analytics.logAction("user_created");
    res.json(data);
  }
}

@HyperModule({
  imports: [AnalyticsService],
  controllers: [MainController]
})
class MainModule { }

@HyperApp({
  name: "Full Feature Bench",
  version: "1.0.0",
  modules: [MainModule]
})
class FullApp { }

describe("Full Features Benchmark & Verification", () => {
  it("should verify the entire stack", async () => {
    const port = 3012;
    const app = await createApplication(FullApp);
    app.useTransform(ZodTransformer);


    try {
      console.log(`-> Listening on 127.0.0.1:${port}...`);
      await app.listen(port, "127.0.0.1");
      console.log("-> Server Ready");

      const doc = getOpenAPI(FullApp);
      expect(doc.info.title).toBe("Full Feature Bench");
      console.log("-> OpenAPI Verified");

      console.log(`-> Fetching http://127.0.0.1:${port}/api/user`);
      const controller = new AbortController();
      const signal = controller.signal;
      const timeout = setTimeout(() => controller.abort(), 3000);

      const resp = await fetch(`http://127.0.0.1:${port}/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "zeno" }),
        signal
      });
      clearTimeout(timeout);

      console.log("-> Response received:", resp.status);
      const data = await resp.json();
      expect(data.parsed).toBe(true);
      console.log("✅ Transformation Verified");

      console.log("-> Fetching /api/status");
      const statusResp = await fetch(`http://127.0.0.1:${port}/api/status`);
      const status = await statusResp.json();
      expect(status.service).toBe(true);
      console.log("✅ DI Verified");

    } finally {
      console.log("-> Closing Server");
      await app.close();
    }
  }, 15000);
});
