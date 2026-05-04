import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperController,
  Get,
  Param,
  Query,
  createApplication,
  HyperException
} from "../src";
import { request } from "undici";
import { IHyperApp } from "../src/type";

// Mock implementation of the user's requirements
const nan = (v: any) => isNaN(Number(v));

const ID = (
  isNumber: boolean = true,
  field: string = 'id',
  validation?: (value: any) => void
) =>
  Param(field, (data: string) => {
    if (isNumber && nan(data)) {
      throw new HyperException(
        `Invalid ${field} provided`,
        'HyperException',
        {},
        400
      );
    }

    if (validation !== undefined) validation(data);

    return isNumber ? parseInt(data) : data;
  });

@HyperController("/test-params")
class ParamTestController {
  @Get("/id/:id")
  async testId(@ID() id: number) {
    return { id, type: typeof id };
  }

  @Get("/string-id/:uid")
  async testStringId(@ID(false, 'uid') uid: string) {
    return { uid, type: typeof uid };
  }

  @Get("/validated/:id")
  async testValidatedId(@ID(true, 'id', (v) => {
    if (Number(v) > 100) throw new Error("Too large");
  }) id: number) {
    return { id };
  }

  @Get("/force")
  async testForce(@Query("force", (v: string) => v === "true") force: boolean) {
    return { force };
  }
}

@HyperModule({
  controllers: [ParamTestController],
})
class TestModule { }

@HyperApp({
  modules: [TestModule],
})
class TestApp { }

describe("Custom Parameter Decorators (ID Pattern)", () => {
  let app: IHyperApp<TestApp>;
  const port = 3025;
  const baseUrl = `http://127.0.0.1:${port}`;

  beforeAll(async () => {
    app = await createApplication(TestApp);
    
    // Register transform for functional parameters
    app.useTransform(({ schema, data }) => {
      if (typeof schema === "function") {
        return schema(data);
      }
      return data;
    });

    await app.listen(port);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("should correctly parse numeric ID", async () => {
    const res = await request(`${baseUrl}/test-params/id/123`);
    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(200);
    expect(data.id).toBe(123);
    expect(data.type).toBe("number");
  });

  it("should correctly parse string ID", async () => {
    const res = await request(`${baseUrl}/test-params/string-id/abc`);
    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(200);
    expect(data.uid).toBe("abc");
    expect(data.type).toBe("string");
  });

  it("should throw 400 when numeric ID is invalid", async () => {
    const res = await request(`${baseUrl}/test-params/id/abc`);
    expect(res.statusCode).toBe(400); // HyperException status is respected
  });

  it("should support custom validation in ID decorator", async () => {
    const resSuccess = await request(`${baseUrl}/test-params/validated/50`);
    expect(resSuccess.statusCode).toBe(200);

    const resFail = await request(`${baseUrl}/test-params/validated/150`);
    expect(resFail.statusCode).toBe(500); // Generic Error results in 500
  });

  it("should support custom Query decorator (Force pattern)", async () => {
    const resTrue = await request(`${baseUrl}/test-params/force?force=true`);
    const dataTrue = (await resTrue.body.json()) as any;
    expect(dataTrue.force).toBe(true);

    const resFalse = await request(`${baseUrl}/test-params/force?force=false`);
    const dataFalse = (await resFalse.body.json()) as any;
    expect(dataFalse.force).toBe(false);

    const resMissing = await request(`${baseUrl}/test-params/force`);
    const dataMissing = (await resMissing.body.json()) as any;
    expect(dataMissing.force).toBe(false);
  });
});
