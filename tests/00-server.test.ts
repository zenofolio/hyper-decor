import { describe, it } from "vitest";
import { createApplication } from "../src";
import { Application } from "./helpers/application";

describe("HyperApp", () => {
  it("app: should create an application with modules and controllers", async () => {
    const app = await createApplication(Application);
    await app.listen(3000);
    await app.close();
  });
});
