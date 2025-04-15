import { describe, it } from "mocha";
import { ok, strictEqual } from "node:assert";
import { request } from "./helpers/request";
import {
  createApplication,
  Get,
  HyperApp,
  HyperController,
  HyperModule,
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
  test(@Res() res: Response) {
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

  before(async () => {
    app = await createApplication(Application);
    await app.listen(3001);
  });

  after(async () => {
    await app.close();
  });

  it("scopes: Method with Scope", async () => {
    try {
      await request("/test");
      ok(false,"Should throw an error");
    } catch (error) {
      ok(true);
    }
  });

  it("scopes: Should without scope", async () => {
    const data = await request("/test/no-scope");
    strictEqual(data, "Hello World!");
  });
});
