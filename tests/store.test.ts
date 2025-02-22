import { describe, test } from "mocha";
import { ok } from "assert";
import { createApplication, ScopeStore } from "../src";
import { Application } from "./helpers/application";

describe("Collectors", () => {
  test("collectors: ScopeStore - should have scope 'app:admin'", async () => {
    const app = await createApplication(Application);
    ok(ScopeStore.getScopeNames().includes("app:admin"));
  });
});
