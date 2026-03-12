import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperController,
  Post,
  Body,
  Transform,
  createApplication,
} from "../src";
import { getOpenAPI } from "../src/lib/openapi";
import { TransformContext } from "../src/__internals/transform/transform.registry";

// 1. Mock Transformer
const ZodTransformer = {
  transform: ({ data, schema }: TransformContext) => {
    if (schema && (schema as any)._type === "zod") {
      return { ...data, parsed: true };
    }
    return data;
  },
  getOpenApiSchema: (schema: any) => {
    if (schema && schema._type === "zod") {
      return {
        type: "object",
        properties: {
          username: { type: "string" },
          parsed: { type: "boolean" }
        }
      };
    }
  }
};

@HyperController("/")
class UserController {
  @Post("/user")
  @Transform({ _type: "zod" })
  createUser(
    @Body() data: { username: string; parsed?: boolean }
  ) {
    return data;
  }
}

@HyperModule({
  controllers: [UserController]
})
class UserModule { }

@HyperApp({
  name: "Transform Test API",
  version: "2.0.0",
  modules: [UserModule]
})
class TransformApp { }

describe("Agnostic Transform & OpenAPI Bridging", () => {
  it("should work agnostically and bridge to OpenAPI", async () => {
    const app = await createApplication(TransformApp);
    app.useTransform(ZodTransformer);

    // A. Verify OpenAPI Generation
    const doc = getOpenAPI(TransformApp);
    expect(doc).toBeDefined();
    expect(doc.info.title).toBe("Transform Test API");

    const path = doc.paths["/user"];
    expect(path).toBeDefined();
    expect(path?.post?.requestBody?.content?.["application/json"]?.schema).toEqual({
      type: "object",
      properties: {
        username: { type: "string" },
        parsed: { type: "boolean" }
      }
    });

    // B. Verify successful instantiation and readiness
    expect(app).toBeDefined();
  });
});
