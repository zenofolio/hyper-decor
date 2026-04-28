import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { HyperApp, HyperController, Get, createApplication, Res, Response, HyperModule } from "../src";
import "reflect-metadata";
import { fetch } from "undici";

@HyperController("/test-returns")
class TestReturnController {
  @Get("/auto")
  async auto() {
    return { datA: 1 };
  }

  @Get("/manual")
  async manual(@Res() res: Response) {
    res.status(201).send("manual-response");
    return { should: "be-ignored" };
  }

  @Get("/string")
  async string() {
    return "hello-world";
  }
}

@HyperModule({
  controllers: [TestReturnController]
})
class TestModule {}

@HyperApp({
  modules: [TestModule]
})
class App {}

describe("Route Return Value Logic", () => {
  let app: any;
  const port = 8089;

  beforeAll(async () => {
    app = await createApplication(App);
    await app.listen(port);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should automatically send returned objects as JSON", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/test-returns/auto`);
    const body = await res.json() as any;
    expect(res.status).toBe(200);
    expect(body).toEqual({ datA: 1 });
  });

  it("should automatically send returned strings as plain text", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/test-returns/string`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toBe("hello-world");
  });

  it("should IGNORE the return value if res.send() was already called", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/test-returns/manual`);
    const body = await res.text();
    expect(res.status).toBe(201);
    expect(body).toBe("manual-response");
  });
});
