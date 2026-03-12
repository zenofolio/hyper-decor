import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  getAppTree,
} from "../src";
import { ApiMethod, ApiResponse } from "../src/lib/openapi/decorators";
import { openApiRegistry } from "../src/lib/openapi/metadata.registry";

// 1. Example of a Custom Collector (Extensibility)
// Imagine we have a custom decorator @Audit() and we want it in the Swagger tree
const KEY_AUDIT = "custom:audit";
const Audit = (message: string): MethodDecorator => 
  (target, key) => Reflect.defineMetadata(KEY_AUDIT, message, target, key);

openApiRegistry.registerCollector("method", (target, propertyKey) => {
  const auditMessage = Reflect.getMetadata(KEY_AUDIT, target, propertyKey!);
  return auditMessage ? { xAudit: auditMessage } : {};
});

// 2. Application Structure
@HyperController({ path: "/orders" })
class OrderController {
  @Get("/:id")
  @Audit("Accessed order details")
  @ApiMethod({ summary: "Get order details" })
  @ApiResponse({ "200": { description: "Order found" } })
  getOrder() { }
}

@HyperModule({
  path: "/shop",
  controllers: [OrderController],
})
class ShopModule { }

@HyperApp({
  modules: [ShopModule],
  name: "Super Store API",
  version: "2.0.0"
})
class StoreApp { }

describe("Extension & Path-Centric Example", () => {
  it("should show how to use the registry and traverse the tree", () => {
    const tree = getAppTree(StoreApp);

    // console.log("--- FULL TREE STRUCTURE ---");
    // console.log(JSON.stringify(tree, null, 2));

    // DEMO: How an adapter would use this
    
    // A. Accessing global info
    expect(tree.app.name).toBe("Super Store API");

    // B. Accessing by Module Name (Record)
    expect(tree.modules["ShopModule"]).toBeDefined();
    
    // C. Accessing by Flattened Path (Easy for Swagger)
    const orderPath = "/shop/orders/:id";
    const routeNodes = tree.paths[orderPath];
    
    expect(routeNodes).toBeDefined();
    expect(routeNodes.length).toBe(1);
    
    const node = routeNodes[0];
    expect(node.method).toBe("get");
    expect(node.openapi.summary).toBe("Get order details");
    
    // D. Verification of Custom Extension (Extensibility)
    expect(node.openapi.xAudit).toBe("Accessed order details");

    console.log(`\nVerified path: ${orderPath}`);
    console.log(`Summary: ${node.openapi.summary}`);
    console.log(`Audit Extension: ${node.openapi.xAudit}`);
  });
});
