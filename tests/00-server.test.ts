import { describe, test } from "mocha";

import { createApplication } from "../src";
import { Application } from "./helpers/application";

describe("HyperApp", () => {
  test("app: should create an application with modules and controllers", async () => {
    const app = await createApplication(Application);
    await app.listen(3000);
    await app.close();
  });
});
