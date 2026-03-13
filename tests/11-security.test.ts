import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  getAppTree,
} from "../src";
import { ApiSecurity, ApiBearerAuth } from "../src/lib/openapi/decorators";

@HyperController({ path: "/secure" })
@ApiSecurity({ classAuth: [] })
class SecureController {
  
  @Get("/private")
  @ApiBearerAuth()
  @ApiSecurity({ methodAuth: ["admin"] })
  getPrivate() { }

  @Get("/public")
  getPublic() { }
}

@HyperModule({
  path: "/v1",
  controllers: [SecureController],
})
class V1Module { }

@HyperApp({
  modules: [V1Module],
})
class App { }

describe("Security Decorators Integration", () => {
  it("should extract security requirements at class and method levels", () => {
    const tree = getAppTree(App);

    const secureCtrl = tree.modules["V1Module"].controllers["SecureController"];
    
    // Class level security
    expect(secureCtrl.openapi.security).toBeDefined();
    expect(secureCtrl.openapi.security.some(s => s.classAuth)).toBe(true);

    // Method level security (Private)
    const privateRoute = secureCtrl.routes.find(r => r.propertyKey === "getPrivate");
    expect(privateRoute?.openapi.security).toBeDefined();
    expect(privateRoute?.openapi.security.length).toBe(2); // BearerAuth + methodAuth
    expect(privateRoute?.openapi.security.some(s => s.bearerAuth)).toBe(true);
    expect(privateRoute?.openapi.security.some(s => s.methodAuth)).toBe(true);

    // Method level security (Public - inherits nothing automatically in Operation object, 
    // but the class has it. OpenAPI usually expects manual override or it applies class level)
    const publicRoute = secureCtrl.routes.find(r => r.propertyKey === "getPublic");
    expect(publicRoute?.openapi.security).toBeUndefined(); // Should be undefined as it's not on method
    
    console.log("Security metadata verified successfully.");
  });
});
