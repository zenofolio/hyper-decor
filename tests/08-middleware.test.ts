import "reflect-metadata";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  createApplication,
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  injectable,
  Middleware,
  MiddlewareNext,
  Request,
  Response,
} from "../src";

@injectable()
class NameService {
  async getName() {
    return "John Doe";
  }
}

@injectable()
class TestMiddleware {
  constructor(private nameService: NameService) {}

  async handle(request: Request, response: Response, next: MiddlewareNext) {
    console.log(`Middleware: ${await this.nameService.getName()}`);
    next();
  }
}

@Middleware(TestMiddleware, async (request: Request, response: Response, next: MiddlewareNext) => {
  console.log("Middleware: app:admin");
  next();
})
@Middleware()
@HyperController()
class TestController {
  @Get("info")
  async info(request: Request, response: Response) {
    return response.json({ message: "Hello World" });
  }
}

@HyperModule({
  path: "/test",
  controllers: [TestController],
})
class TestModule {}

@HyperApp({
  modules: [TestModule],
})
class App {
  onPrepare() {}
}

describe("Middleware", () => {
  let app: any;

  beforeAll(async () => {
    app = await createApplication(App);
    await app.listen(3000);
  });

  afterAll(async () => {
    await app.close();
  });

  it("middleware: should have middleware 'app:admin'", async () => {
    const data = await fetch("http://0.0.0.0:3000/test/info").then((res) =>
      res.json()
    );

    expect(data.message).toBe("Hello World");
  });
});
