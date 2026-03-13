import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperController,
  Get,
  Post,
  Body,
  Query,
  Param,
  Output,
  createApplication,
  IHyperApp,
  transformRegistry,
  getOpenAPI
} from "../src";

// --- Simple Mock Transformer for Testing ---
const TestTransformer = {
  transform: ({ data, schema, options, from }: any) => {
    if (schema === 'IntSchema') return parseInt(data);
    if (schema === 'UpperSchema') return data.toString().toUpperCase();
    
    // Simple DTO simulation
    if (typeof schema === 'function' && schema.name === 'UserDto') {
      return { ...data, transformed: true, from };
    }
    
    return data;
  },
  getOpenApiSchema: (schema: any) => {
    if (schema === 'IntSchema') return { type: 'integer' };
    if (schema === 'UpperSchema') return { type: 'string', format: 'uppercase' };
    if (typeof schema === 'function' && schema.name === 'UserDto') {
      return { 
        type: 'object', 
        properties: { 
          id: { type: 'integer' }, 
          name: { type: 'string' } 
        } 
      };
    }
    return undefined;
  }
};

transformRegistry.register(TestTransformer);

// --- DTO Classes ---
class UserDto {
  id!: number;
  name!: string;
}

// --- Controller ---
@HyperController("/test")
class TestController {

  @Get("query-key")
  async testQueryKey(@Query("id", "IntSchema") id: number) {
    return { id, type: typeof id };
  }

  @Get("query-dto")
  async testQueryDto(@Query(UserDto) query: UserDto) {
    return query;
  }

  @Post("body")
  async testBody(@Body(UserDto) body: UserDto) {
    return body;
  }

  @Get("param/:id")
  async testParam(@Param("id", "IntSchema") id: number) {
    return { id, type: typeof id };
  }

  @Get("output")
  @Output("UpperSchema")
  async testOutput() {
    return "hello world";
  }

  @Get("inferred")
  testInferred(): UserDto {
    // Note: TypeScript emits 'design:returntype' as UserDto if synchronous
    return { id: 1, name: "zeno" } as any;
  }
}

@HyperModule({
  controllers: [TestController]
})
class TestModule { }

@HyperApp({
  name: "TestApp",
  modules: [TestModule]
})
class App { }

describe("Polymorphic Interception & OpenAPI", () => {
  let app: IHyperApp<App>;
  let port: number;

  beforeAll(async () => {
    port = 3019;
    app = await createApplication(App);
    await app.listen(port);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe("Runtime Transformation", () => {
    it("should transform query key using schema", async () => {
      const resp = await fetch(`http://127.0.0.1:${port}/test/query-key?id=123`);
      const data = await resp.json();
      expect(data.id).toBe(123);
      expect(data.type).toBe("number");
    });

    it("should transform whole query using DTO", async () => {
      const resp = await fetch(`http://127.0.0.1:${port}/test/query-dto?id=1&name=zeno`);
      const data = await resp.json();
      expect(data.id).toBe("1"); // Transformer just added 'transformed: true' in this mock logic
      expect(data.transformed).toBe(true);
      expect(data.from).toBe("query");
    });

    it("should transform body using DTO", async () => {
      const resp = await fetch(`http://127.0.0.1:${port}/test/body`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, name: "zeno" })
      });
      const data = await resp.json();
      expect(data.transformed).toBe(true);
      expect(data.from).toBe("body"); // Body decorator now uses 'body' as source key
    });

    it("should transform output using @Output", async () => {
      const resp = await fetch(`http://127.0.0.1:${port}/test/output`);
      const data = await resp.json();
      expect(data).toBe("HELLO WORLD");
    });

    it("should transform inferred output", async () => {
      const resp = await fetch(`http://127.0.0.1:${port}/test/inferred`);
      const data = await resp.json();
      // In our mock, if schema is UserDto, it adds transformed: true
      expect(data.transformed).toBe(true);
      expect(data.from).toBe("response");
    });
  });

  describe("OpenAPI Generation", () => {
    it("should generate correct OpenAPI spec", () => {
      const spec = getOpenAPI(App);
      
      // Check query-key (Single parameter)
      const queryKeyOp = spec.paths["/test/query-key"]?.get;
      expect(queryKeyOp?.parameters?.find((p: any) => p.name === "id")?.schema).toEqual({ type: 'integer' });

      // Check query-dto (Exploded parameters)
      const queryDtoOp = spec.paths["/test/query-dto"]?.get;
      expect(queryDtoOp?.parameters?.some((p: any) => p.name === "id")).toBe(true);
      expect(queryDtoOp?.parameters?.some((p: any) => p.name === "name")).toBe(true);

      // Check body
      const bodyOp = spec.paths["/test/body"]?.post;
      expect(bodyOp?.requestBody?.content?.['application/json']?.schema?.type).toBe('object');

      // Check output
      const outputOp = spec.paths["/test/output"]?.get;
      expect(outputOp?.responses?.['200']?.content?.['application/json']?.schema).toEqual({ 
        type: 'string', 
        format: 'uppercase' 
      });
    });
  });
});
