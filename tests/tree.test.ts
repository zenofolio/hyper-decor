import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  getAppTree,
} from "../src";

@HyperController({ path: "/user" })
class UserController {
  @Get("/:id")
  getUser() { }
}

@HyperModule({
  path: "/v1",
  controllers: [UserController],
})
class V1Module { }

@HyperApp({
  modules: [V1Module],
})
class App { }

describe("Tree Extraction", () => {
  it("should extract the correct application tree", () => {
    const tree = getAppTree(App);
    console.log(JSON.stringify(tree, null, 2));

    expect(tree.app).toBeDefined();
    expect(tree.modules["V1Module"]).toBeDefined();
    expect(tree.modules["V1Module"].metadata.path).toBe("/v1");
    expect(tree.modules["V1Module"].controllers["UserController"]).toBeDefined();
    expect(tree.modules["V1Module"].controllers["UserController"].metadata.path).toBe("/user");
    expect(tree.modules["V1Module"].controllers["UserController"].routes.length).toBe(1);
    expect(tree.modules["V1Module"].controllers["UserController"].routes[0].path).toBe("/:id");
    expect(tree.modules["V1Module"].controllers["UserController"].routes[0].method).toBe("get");

    // Verify flattened paths
    expect(tree.paths["/v1/user/:id"]).toBeDefined();
    expect(tree.paths["/v1/user/:id"][0].method).toBe("get");
  });
});
