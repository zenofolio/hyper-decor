import { describe, it } from "vitest";
import { createApplication } from "../src";
import { Application } from "./helpers/application";

describe("Service", () => {
  it("should register the class with the container", async () => {
    await createApplication(Application);
  });
});
