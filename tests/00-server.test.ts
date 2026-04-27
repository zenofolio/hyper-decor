import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { createApplication, Get, HyperApp, HyperController, HyperModule, injectable, OnInit, Res, Response, singleton, IsSingleton } from "../src";
import { request } from "./helpers/request";



@injectable()
@singleton()
class TestService implements OnInit {
  static count = 0;

  constructor() {
    TestService.count++;
  }
  async onInit(): Promise<any> {
    TestService.count++;
  }


}

@HyperController("/unit")
class AppController {
  @Get("/")
  async services(@Res() res: Response) {
    res.json({ message: "hello" });
  }
}

@HyperModule({
  path: "/test",
  controllers: [AppController],
  imports: [TestService]
})
class AppModule { }

@HyperApp({
  name: "api",
  modules: [AppModule],
  imports: [TestService],
  logs: {
    modules: true,
    controllers: true,
    middleware: true,
    routes: true,
  }
})
class Application {

}

const PORT = 3010;


describe("HyperApp", () => {
  it("app: should create an application with modules and controllers", async () => {
    const app = await createApplication(Application);
    await app.listen(PORT);

    try {
      const body = await request("/test/unit", undefined, PORT);
      console.log(body, "es] Application/AppModule/AppController/service")
    } finally {
      await app.close();
    }
  });

  it("app: singleton must be initialzed 1 time", async () => {
    await createApplication(Application);
    expect(TestService.count).toBe(2);
  });
});
