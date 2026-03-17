import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperController,
  Get,
  Res,
  Response,
  createApplication,
  Req,
  Request,
  Middleware
} from "../src";

const TestMiddleware = (req: Request, res: Response, next: any) => {
  req.setValue("middleware_injection", "12345");
  next();
};


@HyperController("/state")
class StateController {

  @Get()
  async test(@Req() req: Request, @Res() res: Response) {
    // 1. Basic value
    req.setValue("test_key", "test_value");
    const val = req.getValue("test_key");

    // 2. Object value
    req.setValue("obj", { name: "zeno" });
    const obj = req.getValue<{ name: string }>("obj");

    // 3. Default value
    const missing = req.getValue("missing", "default_val");

    // 4. Overwrite/Delete
    req.setValue("temp", "to_be_deleted");
    req.setValue("temp", undefined);
    const deleted = req.getValue("temp");

    const result = {
      val,
      obj,
      missing,
      deleted: deleted === undefined
    };
    res.json(result);
  }

  @Get("middleware")
  async testMiddleware(@Req() req: Request, @Res() res: Response) {
    const middleware_injection = req.getValue("middleware_injection");
    res.json({ middleware_injection });
  }
}

@Middleware(TestMiddleware)
@HyperModule({
  controllers: [StateController]
})
class StateModule { }

@HyperApp({
  modules: [StateModule]
})
class App { }

import { container } from "tsyringe";
import { IHyperApp } from "../src/type";

describe("Request State (setValue/getValue)", () => {

  let app: IHyperApp<App>;
  let port: number;

  beforeAll(async () => {
    port = 3015;
    app = await createApplication(App);
    await app.listen(port);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("verify prototype", () => {
    expect(typeof Request.prototype.setValue).toBe("function");
  });

  it("should correctly set and get values within the same request lifecycle", async () => {
    container.reset();
    const resp = await fetch(`http://127.0.0.1:${port}/state`);
    expect(resp.status).toBe(200);
    const data = await resp.json();


    expect(data.val).toBe("test_value");
    expect(data.obj.name).toBe("zeno");
    expect(data.missing).toBe("default_val");
    expect(data.deleted).toBe(true);
  });

  it("should pass data from middleware to controller via request state", async () => {

    const resp = await fetch(`http://127.0.0.1:${port}/state/middleware`);
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.middleware_injection).toBe("12345");
  });
});
