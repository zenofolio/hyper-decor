import { describe, it, expect } from "vitest";
import { Metadata } from "../../src/__internals/stores/meta.store";
import { mergeMetadata } from "../../src/__internals/helpers/merge-metadata";
import { HyperMetadataStore } from "../../src/__internals/types";

const HyperMeta = Metadata.prefix('server');

class A {}
class B {}

HyperMeta.set(A, undefined, {
  type: 'controller',
  middlewares: [() => {}],
  roles: ['admin'],
} as any);

HyperMeta.set(B, undefined, {
  type: 'controller',
  middlewares: [() => {}],
  roles: ['user'],
} as any);

describe("mergeMetadata: should merge metadata from two classes", () => {
  it("mergeMetadata: should merge metadata from two classes", async () => {
    mergeMetadata(A, B, ["middlewares", "roles"]);

    const root = Metadata.get<HyperMetadataStore>(A);
    const metadataA = root.server?.common;

    expect(metadataA?.middlewares?.length).toBe(2);
    expect(metadataA?.roles).toContain("admin");
    expect(metadataA?.roles).toContain("user");
  });
});
