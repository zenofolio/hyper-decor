import { describe, test, it } from "mocha";
import { ok } from "assert";
import { collectClassData } from "../src/common/openapi";
import { Application } from "./helpers/application";

describe("Extract data from class to OpenAPI", () => {
  it("openapi: should extract data from class to OpenAPI", async () => {
    const result = await collectClassData(Application);
    ok(result);
  });
});
