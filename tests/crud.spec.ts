import { describe, test } from "mocha";
import { Server } from "hyper-express";
import {} from "../src/extension";
import { ok } from "assert";

import { Application } from "./helpers/application";
import { createApplication } from "../src/common/bootstrap";
import { request } from "./helpers/request";

const app = new Application();

describe("CRUD", () => {
  let app: Application & Server;

  before(async () => {
    app = await createApplication(Application);

    app.set_error_handler((req, res, error) => {
      res.status(500).send(error.message);
    });

    await app.listen(3001);
  });

  after(async () => {
    await (app as any).close();
  });

  test("CRUD: Hello World", async () => {
    ok(app);
  });

  test("CRUD: Routes should be set", async () => {
    ok(Object.keys(app.routes["get"]).length > 0);
  });

  test("CRUD: make get request", async () => {
    const result = await request("/api/test/unit");
    ok(result === "hello");
  });

  test("CRUD: test scope", async () => {
    await request("/api/test/unit/list")
      .then((result) => {
        ok(result === "hello");
      })
      .catch((error) => {
        ok(error.message === "Only authorized account can read users");
      });
  });

  test("CRUD: test post request", async () => {
    await request("/api/test/unit/details/1", { name: "John Doe" })
      .then((result) => {
        ok(result === "John Doe");
      })
      .catch((error) => {
        ok(error.message === "Method not implemented.");
      });
  });
});
