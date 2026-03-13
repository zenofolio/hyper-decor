import "reflect-metadata";
import {
  HyperApp,
  HyperModule,
  HyperController,
  Get,
  Query,
  transformRegistry
} from "../src";

import { getOpenAPI } from "../src/lib/openapi";

// --- Simple Mock Transformer for Testing ---
const TestTransformer = {
  transform: ({ data, schema }: any) => data,
  getOpenApiSchema: (schema: any) => {
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

class UserDto {
  id!: number;
  name!: string;
}

@HyperController("/test")
class TestController {
  @Get("dto")
  async testDto(@Query(UserDto) query: UserDto) {
    return query;
  }
}

@HyperModule({ controllers: [TestController] })
class TestModule { }

@HyperApp({ modules: [TestModule] })
class App { }

try {
  const spec = getOpenAPI(App);
  console.log("OpenAPI Spec generated successfully");
  const dtoOp = spec.paths["/test/dto"].get;
  console.log("Parameters count:", dtoOp?.parameters?.length);
  dtoOp?.parameters?.forEach((p: any) => console.log(`- ${p.name} (${p.in})`));

  if (dtoOp?.parameters?.length === 2 && dtoOp?.parameters?.some((p: any) => p.name === "id")) {
    console.log("SUCCESS: Parameters exploded correctly");
  } else {
    console.error("FAILURE: Parameters NOT exploded correctly");
    process.exit(1);
  }

  // Check Output
  const outputOp = spec.paths["/test/dto"].get; // Assuming same path for simplicity in check
  if (outputOp?.responses && outputOp?.responses["200"]) {
    console.log("SUCCESS: Response 200 found");
  } else {
    console.error("FAILURE: Response 200 NOT found");
    process.exit(1);
  }
} catch (e) {
  console.error("Failed to generate OpenAPI spec:", e);
  process.exit(1);
}
