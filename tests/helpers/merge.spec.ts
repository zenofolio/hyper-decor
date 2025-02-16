import { describe } from "mocha";
import { ok } from "assert";
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

    ok(metadataA.fields.includes("personal"));
    ok(metadataA.fields.includes("phone"));

    ok(metadataA.contries.USA.includes("New York"));
    ok(metadataA.contries.USA.includes("California"));
  });
});
