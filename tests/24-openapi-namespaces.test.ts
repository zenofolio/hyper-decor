import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperController,
  Get,
} from "../src";
import { OpenApi, getOpenAPI } from "../src/lib/openapi";

@HyperController("/public")
class PublicController {
  @Get("/info")
  @OpenApi.Namespace("public")
  @OpenApi.Summary("Public info")
  info() {}

  @Get("/ignore")
  @OpenApi.Ignore()
  ignoredMethod() {}
}

@HyperController("/admin")
@OpenApi.Namespace("admin")
class AdminController {
  @Get("/dashboard")
  @OpenApi.Summary("Admin dashboard")
  dashboard() {}

  @Get("/users")
  @OpenApi.Namespace("super-admin")
  @OpenApi.Summary("User list")
  users() {}
}

@HyperController("/hidden")
@OpenApi.Ignore()
class HiddenController {
  @Get("/secret")
  secret() {}
}

@HyperModule({
  controllers: [PublicController, AdminController, HiddenController]
})
class TestModule {}

@HyperApp({
  modules: [TestModule]
})
class App {}

describe("OpenAPI Namespacing and Filtering", () => {
  it("should generate full spec when no filters are provided (respecting Ignore)", () => {
    const spec = getOpenAPI(App);
    
    // Should have public info
    expect(spec.paths["/public/info"]).toBeDefined();
    
    // Should have admin dashboard (inherited namespace)
    expect(spec.paths["/admin/dashboard"]).toBeDefined();
    
    // Should have super-admin user list (overridden namespace)
    expect(spec.paths["/admin/users"]).toBeDefined();

    // Should NOT have ignored method
    expect(spec.paths["/public/ignore"]).toBeUndefined();

    // Should NOT have ignored controller
    expect(spec.paths["/hidden/secret"]).toBeUndefined();
  });

  it("should filter by includeNamespaces (Pick)", () => {
    const spec = getOpenAPI(App, { includeNamespaces: ["public"] });

    // Should have public info
    expect(spec.paths["/public/info"]).toBeDefined();

    // Should NOT have admin dashboard
    expect(spec.paths["/admin/dashboard"]).toBeUndefined();

    // Should NOT have super-admin user list
    expect(spec.paths["/admin/users"]).toBeUndefined();
  });

  it("should filter by excludeNamespaces (Omit)", () => {
    const spec = getOpenAPI(App, { excludeNamespaces: ["admin"] });

    // Should have public info
    expect(spec.paths["/public/info"]).toBeDefined();

    // Should NOT have admin dashboard
    expect(spec.paths["/admin/dashboard"]).toBeUndefined();

    // Should have super-admin user list
    expect(spec.paths["/admin/users"]).toBeDefined();
  });

  it("should support multiple namespaces in includeNamespaces", () => {
    const spec = getOpenAPI(App, { includeNamespaces: ["public", "super-admin"] });

    // Should have public info
    expect(spec.paths["/public/info"]).toBeDefined();

    // Should have super-admin user list
    expect(spec.paths["/admin/users"]).toBeDefined();

    // Should NOT have admin dashboard
    expect(spec.paths["/admin/dashboard"]).toBeUndefined();
  });
});
