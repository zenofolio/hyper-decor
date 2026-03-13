import "reflect-metadata";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  createApplication,
} from "../src";
import { UserService } from "./helpers/service";
import { Request, Response } from "hyper-express";
import { request } from "./helpers/request";

@HyperController()
class UserController {
  constructor(private service: UserService) { }

  @Get("/")
  async user(request: Request, response: Response) {
    response.json({ message: this.service.hello() });
  }
}

@HyperModule({
  path: "/",
  controllers: [UserController],
})
class Module { }

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

describe("Dependencies", () => {
  let app: any;

  beforeAll(async () => {
    app = await createApplication(App);
    await app.listen(3002);
  });

  afterAll(async () => {
    await app.close();
  });

  it("dependencies: should create an instance of the class", async () => {
    const data = JSON.parse(await request("/api/", undefined, 3002));
    expect(data.message).toBe("hello");
  });
});
