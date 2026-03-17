console.error("[TEST] 10-openapi.test.ts loading");
import "reflect-metadata";
import { describe, it, expect, beforeAll } from "vitest";
import {
  HyperController,
  HyperModule,
  HyperApp,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  Headers,
  Output,
  getOpenAPI,
  createApplication
} from "../src";
import { 
  ApiSecurity, 
  ApiTag, 
  ApiMethod, 
  ApiSummary, 
  ApiDescription, 
  ApiOperationId 
} from "../src/lib/openapi/decorators";

class UserDto {
  name!: string;
  age!: number;
}

class ProjectDto {
  title!: string;
  active!: boolean;
}

class ResponseDto {
  success!: boolean;
  data: any;
}

@HyperController("/users")
@ApiTag("Users")
@ApiSecurity({ bearerAuth: [] })
class UserController {
  @Get("/:id")
  @ApiSummary("Get user by ID")
  @ApiOperationId("getUser")
  async findOne(@Param("id") id: string) {
    return { id, name: "Test" };
  }

  @Post("/")
  @ApiDescription("Create a new user")
  async create(@Body(UserDto) user: UserDto) {
    return user;
  }

  @Get("/search")
  search(@Query("q") query: string) {
    return [query];
  }

  @Put("/:id/project")
  @ApiSecurity({ apiKey: [] })
  addProject(
    @Param("id") id: string,
    @Body("project", ProjectDto) project: ProjectDto,
    @Headers("x-trace-id") traceId: string
  ) {
    return { id, project, traceId };
  }

  @Post("/complex-output")
  @Output(ResponseDto)
  complexOutput() {
    return { success: true, data: {} };
  }
}

@HyperModule({
  controllers: [UserController]
})
class UserModule {}

@HyperApp({
  modules: [UserModule],
  name: "OpenAPI Test App",
  version: "2.0.0",
  description: "App for testing OpenAPI generation"
})
class TestApp {}

describe("OpenAPI Generation: Deep Field Validation", () => {
  let doc: any;

  beforeAll(async () => {
    console.error("[TEST] Calling createApplication");
    await createApplication(TestApp);
    doc = getOpenAPI(TestApp);
    console.error("[TEST] OpenAPI Doc generated with summary:", doc.paths["/users/{id}"]?.get?.summary);
  });

  it("should have correct basic info", () => {
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.info.title).toBe("OpenAPI Test App");
    expect(doc.info.version).toBe("2.0.0");
  });

  it("should validate Path Parameters", () => {
    const findOne = doc.paths["/users/{id}"]?.get;
    expect(findOne).toBeDefined();
    expect(findOne.parameters).toContainEqual(expect.objectContaining({
      name: "id",
      in: "path",
      required: true
    }));
  });

  it("should validate Query Parameters", () => {
    const search = doc.paths["/users/search"]?.get;
    expect(search).toBeDefined();
    expect(search.parameters).toContainEqual(expect.objectContaining({
      name: "q",
      in: "query"
    }));
  });

  it("should validate Header Parameters", () => {
    const addProject = doc.paths["/users/{id}/project"]?.put;
    expect(addProject.parameters).toContainEqual(expect.objectContaining({
      name: "x-trace-id",
      in: "header"
    }));
  });

  it("should validate Request Body (Whole Source)", () => {
    const create = doc.paths["/users"]?.post;
    expect(create).toBeDefined();
    expect(create?.requestBody?.content?.["application/json"]).toBeDefined();
    expect(create?.requestBody?.content?.["application/json"].schema).toBeDefined();
  });

  it("should validate Request Body (Nested Key + DTO)", () => {
    const addProject = doc.paths["/users/{id}/project"]?.put;
    expect(addProject).toBeDefined();
    expect(addProject?.requestBody?.content?.["application/json"]).toBeDefined();
    const schema = addProject?.requestBody?.content?.["application/json"].schema;
    expect(schema.properties?.project).toBeDefined();
  });

  it("should validate Output Schema (@Output)", () => {
    const complexOutput = doc.paths["/users/complex-output"]?.post;
    expect(complexOutput?.responses?.["200"]).toBeDefined();
    expect(complexOutput?.responses?.["200"].content?.["application/json"].schema).toBeDefined();
  });

  it("should validate Security Requirements", () => {
    const findOne = doc.paths["/users/{id}"]?.get;
    expect(findOne?.security).toContainEqual({ bearerAuth: [] });

    const addProject = doc.paths["/users/{id}/project"]?.put;
    expect(addProject?.security).toContainEqual({ apiKey: [] });
  });

  it("should validate Metadata (Summary, operationId, Tags)", () => {
    const findOne = doc.paths["/users/{id}"]?.get;
    expect(findOne?.summary).toBe("Get user by ID");
    expect(findOne?.operationId).toBe("getUser");
    expect(findOne?.tags).toContainEqual(expect.objectContaining({ name: "Users" }));
  });
});
