import { ok } from "assert";
import {
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  createApplication,
} from "../src";
import { describe, test } from "mocha";
import { Service } from "./helpers/service";
import { Request, Response } from "hyper-express";
import { request } from "./helpers/request";

@HyperController()
class UserController {
  constructor(private service: Service) {}

  @Get("/")
  async user(request: Request, response: Response) {
    response.json({ message: this.service.hello() });
  }
}

@HyperModule({
  path: "/",
  controllers: [UserController],
})
class Module {}

@HyperApp({
  prefix: "/api",
  modules: [Module],
  options: {
    max_body_length: 1024 * 1024 * 10,
  },
})
class App {
  onPrepare() {
    console.log("App is prepared");
  }
}

describe("Dependecies", () => {
  let app: App;

  before(async () => {
    const server = await createApplication(App);
    server.listen(3001, () => console.log(`Server is running on port 3001`));
    app = server;
  });

  after(() => {
    (app as any).close();
  });

  test("dependecies: should create an instance of the class", async () => {
    const data = JSON.parse(await request("/api/"));
    ok(data.message === "hello");
  });
});
