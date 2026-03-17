import "reflect-metadata";
import { describe, it } from "vitest";
import { createApplication, Get, HyperApp, HyperController, HyperModule, Res, Response } from "../src";
import { request } from "./helpers/request";


@HyperController({
  path: "/unit",
})
class AppController {
  @Get("/")
  async services(@Res() res: Response) {
    res.json({ message: "hello" });
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

    console.log(app, "app")

    try {
      const body = await request("/test/unit", undefined, PORT);
      console.log(body, "es] Application/AppModule/AppController/service")
    } finally {
      await app.close();
    }
  });
});
