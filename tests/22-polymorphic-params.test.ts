import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperController,
  Post,
  Get,
  Query,
  Body,
  Param,
  Headers,
  createApplication,
} from "../src";
import { request } from "undici";
import { IHyperApp } from "../src/type";

class UserDto {
  constructor(public name: string, public email: string) { }
}

@HyperController("/poly")
class PolyController {
  @Post("/body-dto")
  async bodyDto(@Body(UserDto) user: UserDto) {
    return { name: user.name, type: user.constructor.name };
  }

  @Post("/body-key-dto")
  async bodyKeyDto(@Body("user", UserDto) user: UserDto) {
    return { name: user.name, type: user.constructor.name };
  }

  @Get("/query-fn")
  async queryFn(@Query("id", (v: string) => parseInt(v) * 2) id: number) {
    return { id, type: typeof id };
  }

  @Get("/query-root-fn")
  async queryRootFn(@Query((q: any) => ({ ...q, extra: true })) query: any) {
    return query;
  }

  @Get("/param-fn/:uid")
  async paramFn(@Param("uid", (v: string) => `user_${v}`) uid: string) {
    return { uid };
  }

  @Get("/headers-fn")
  async headersFn(@Headers("x-custom", (v: string) => v.toUpperCase()) custom: string) {
    return { custom };
  }
}

@HyperModule({
  controllers: [PolyController],
})
class PolyModule { }

@HyperApp({
  modules: [PolyModule],
})
class PolyApp { }

describe("Polymorphic & Functional Parameter Decorators", () => {
  let app: IHyperApp<PolyApp>;
  const port = 3019;
  const baseUrl = `http://127.0.0.1:${port}`;

  beforeAll(async () => {
    app = await createApplication(PolyApp);

    app.useTransform(({ schema, data }) => {
      console.log(schema, data);
      if (schema === UserDto) {
        return new UserDto(data.name, data.email);
      } else if (typeof schema === "function") {
        return schema(data);
      }

    })

    await app.listen(port);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("should support @Body(DTO) - Root transformation", async () => {
    const res = await request(`${baseUrl}/poly/body-dto`, {
      method: "POST",
      body: JSON.stringify({ name: "John", email: "john@example.com" }),
      headers: { "content-type": "application/json" },
    });

    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(200);
    expect(data.name).toBe("John");
    // Note: Since we don't have a real DTO validator/transformer registered in the test helper yet that actually instantiates the class, 
    // it will return the object. But our system marks it correctly.
  });

  it("should support @Body('key', DTO) - Key transformation", async () => {
    const res = await request(`${baseUrl}/poly/body-key-dto`, {
      method: "POST",
      body: JSON.stringify({ user: { name: "Jane", email: "jane@example.com" } }),
      headers: { "content-type": "application/json" },
    });

    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(200);
    expect(data.name).toBe("Jane");
  });

  it("should support functional transformers in @Query", async () => {
    const res = await request(`${baseUrl}/poly/query-fn?id=21`);
    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(200);
    expect(data.id).toBe(42);
    expect(data.type).toBe("number");
  });

  it("should support functional transformers in @Query (root)", async () => {
    const res = await request(`${baseUrl}/poly/query-root-fn?page=1`);
    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(200);
    expect(data.page).toBe("1");
    expect(data.extra).toBe(true);
  });

  it("should support functional transformers in @Param", async () => {
    const res = await request(`${baseUrl}/poly/param-fn/123`);
    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(200);
    expect(data.uid).toBe("user_123");
  });

  it("should support functional transformers in @Headers", async () => {
    const res = await request(`${baseUrl}/poly/headers-fn`, {
      headers: { "x-custom": "hello" }
    });
    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(200);
    expect(data.custom).toBe("HELLO");
  });
});
