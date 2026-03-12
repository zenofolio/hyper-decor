import { describe, it } from "vitest";
import { createApplication, Get, HyperApp, HyperController, HyperModule, Res, Response } from "../src";
import { request } from "./helpers/request";


@HyperController()
class AppController {

  @Get("unit")
  async services(
    @Res() res: Response
  ) {
    console.log("hello")
    res.send("hello")
  }
}

@HyperModule({
  path: "/test",
  controllers: [AppController]
})
class AppModule { }

@HyperApp({
  name: "api",
  modules: [AppModule],
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
    await request("/test/unit", undefined, PORT);
    await app.close();
  }, 10000);
});
