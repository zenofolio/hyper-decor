import { describe, it, expect } from "vitest";
import "reflect-metadata";
import { mergeMetadata } from "../../src/__internals/helpers/merge-metadata";

class A {}
class B {}

Reflect.defineMetadata(
  "key",
  {
    fields: ["name", "city"],
    contries: {
      USA: ["New York", "California"],
      Canada: ["Toronto", "Vancouver"],
    },
  },
  A
);
Reflect.defineMetadata(
  "key",
  {
    fields: ["personal", "phone"],
    contries: {
      USA: ["New York", "California"],
      Atlanta: ["eee", "aa"],
    },
  },
  B
);

describe("mergeMetadata: should merge metadata from two classes", () => {
  it("mergeMetadata: should merge metadata from two classes", async () => {
    mergeMetadata(A, B, ["key"]);

    const metadataA = Reflect.getMetadata("key", A);

    expect(metadataA.fields).toContain("personal");
    expect(metadataA.fields).toContain("phone");

    expect(metadataA.contries.USA).toContain("New York");
    expect(metadataA.contries.USA).toContain("California");
  });
});
