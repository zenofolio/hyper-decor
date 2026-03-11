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
  getUser() {}
}

@HyperModule({
  path: "/v1",
  controllers: [UserController],
})
class V1Module {}

@HyperApp({
  modules: [V1Module],
})
class App {}

describe("Tree Extraction", () => {
  it("should extract the correct application tree", () => {
    const tree = getAppTree(App);
    
    expect(tree.app).toBeDefined();
    expect(tree.modules.length).toBe(1);
    expect(tree.modules[0].metadata.path).toBe("/v1");
    expect(tree.modules[0].controllers.length).toBe(1);
    expect(tree.modules[0].controllers[0].metadata.path).toBe("/user");
    expect(tree.modules[0].controllers[0].routes.length).toBe(1);
    expect(tree.modules[0].controllers[0].routes[0].path).toBe("/:id");
    expect(tree.modules[0].controllers[0].routes[0].method).toBe("get");
  });
});
