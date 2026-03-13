import { describe, it, expect } from "vitest";
import { createApplication, ScopeStore } from "../src";
import { Application } from "./helpers/application";

describe("Collectors", () => {
  it("collectors: ScopeStore - should have scope 'app:admin'", async () => {
    await createApplication(Application);
    expect(ScopeStore.getScopeNames()).toContain("app:admin");
  });
});
