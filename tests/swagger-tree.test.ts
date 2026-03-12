import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  Get,
  Post,
  HyperApp,
  HyperController,
  HyperModule,
  getAppTree,
  Query,
  Body,
  Param,
  Headers,
  Put
} from "../src";
import { ApiMethod, ApiResponse } from "../src/lib/openapi/decorators";
import { openApiRegistry } from "../src/lib/openapi/metadata.registry";

// Custom Extension for the test
openApiRegistry.registerCollector("method", (target, propertyKey) => {
  return { xVersion: "1.0" };
});

class CreateUserDto {
  constructor(
    public username: string,
    public email: string
  ) { }
}

@HyperController({ path: "/profile" })
class ProfileController {
  @Get("/")
  getProfile() { }
}

@HyperController({ path: "/user" })
class UserController {
  @Get("/:id")
  @ApiMethod({
    summary: "Get user by ID",
    tags: [{
      name: "Users",
      description: "User operations"
    }]
  })
  @ApiResponse({ "200": { description: "User found" } })
  getUser(
    @Query("id") id: string,
    @Param("id") slug: string,
    @Headers("x-token") token: string
  ) {

  }

  @Post("/")
  @ApiMethod({ summary: "Create a new user" })
  createUser(@Body() data: CreateUserDto) { }

  @Put("/")
  @ApiMethod({ summary: "Update a user" })
  updateUser(@Body() data: CreateUserDto) { }
}

@HyperModule({
  path: "/config",
  controllers: [],
})
class ConfigModule { }

@HyperModule({
  path: "/auth",
  modules: [ConfigModule],
  controllers: [ProfileController],
})
class AuthModule { }

@HyperModule({
  path: "/v1",
  modules: [AuthModule],
  controllers: [UserController],
})
class V1Module { }

@HyperApp({
  modules: [V1Module],
  name: "Super Deep Test App",
  version: "1.2.3"
})
class App { }

describe("Swagger Tree Integration", () => {
  it("should extract a complete tree with OpenAPI metadata and super deep hierarchy", () => {
    const tree = getAppTree(App);

    // 1. App Level
    expect(tree.app.name).toBe("Super Deep Test App");

    // 2. 3-Level Nesting
    const v1 = tree.modules["V1Module"];
    const auth = v1.modules["AuthModule"];
    const config = auth.modules["ConfigModule"];
    expect(config).toBeDefined();
    expect(config.fullPath).toBe("/v1/auth/config");

    // 3. Multi-method Path
    const rootUserPath = "/v1/user/";
    const routes = tree.paths[rootUserPath];
    expect(routes).toBeDefined();
    expect(routes.length).toBe(2); // Post and Put
    expect(routes.some(r => r.method === "post")).toBe(true);
    expect(routes.some(r => r.method === "put")).toBe(true);

    // Verify detailed route metadata
    const postRoute = routes.find(r => r.method === "post");
    expect(postRoute?.openapi.summary).toBe("Create a new user");

    console.log("Super deep hierarchy and multi-method paths verified.");
  });
});
