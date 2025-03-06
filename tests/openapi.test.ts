import { describe, test, it } from "mocha";
import { ok } from "assert";
import { collectClassMetadata } from "../src/lib/openapi/collectors/class.collector";
import { ApiSecurity, ApiMethod } from "../src/lib/openapi/decorators";

@ApiSecurity({ bearerAuth: [] })
class UserModule {
  async getUserById(userId: string) {}
  async createUser(user: any) {}
}

describe("Extract data from class to openapi", () => {
  it("openapi: should extract data from class to OpenAPI", async () => {
    const result = collectClassMetadata(UserModule);
    console.log(result.methods.getUserById);
    ok(result);
  });
});
