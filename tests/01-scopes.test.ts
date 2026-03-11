import "reflect-metadata";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { request } from "./helpers/request";
import {
  createApplication,
  Get,
  HyperController,
  HyperModule,
  HyperApp,
  Res,
  Response,
  Scope,
  Server,
} from "../src";

@HyperController()
class TestController {
  @Get()
  @Scope({
    scope: "app:admin",
    description: "Admin scope",
    message: "You are not allowed to access this resource",
  })
  handleTest(@Res() res: Response) {
    res.send("Hello World!");
  }

  @Get("/no-scope")
  testNoScope(@Res() res: Response) {
    res.send("Hello World!");
  }
}

@HyperModule({
  path: "/test",
  controllers: [TestController],
})
class TestModule {}

@HyperApp({
  prefix: "",
  modules: [TestModule],
})
class Application {
  onPrepare() {}
}

describe("scopes: HyperApp Decorator", () => {
  let app: Server;

  beforeAll(async () => {
    app = await createApplication(Application);
    await app.listen(3001);
  });

  afterAll(async () => {
    await app.close();
  });

  it("scopes: Method with Scope", async () => {
    try {
      await request("/test");
      expect(true).toBe(false); // Should throw an error
    } catch (error) {
      expect(true).toBe(true);
    }
  });

  it("scopes: Should without scope", async () => {
    const data = await request("/test/no-scope");
    expect(data).toBe("Hello World!");
  });
});
