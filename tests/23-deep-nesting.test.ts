import "reflect-metadata";
import { describe, it, expect } from "vitest";
import {
  createApplication,
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  Res,
  Response,
  getAppTree,
} from "../src";
import { request } from "./helpers/request";

@HyperController({ path: "/deep" })
class DeepController {
  @Get("/hello")
  async sayHello(@Res() res: Response) {
    res.json({ message: "hello from the depths" });
  }
}

@HyperModule({
  path: "/level2",
  controllers: [DeepController],
})
class Level2Module {}

@HyperModule({
  path: "/level1",
  modules: [Level2Module],
})
class Level1Module {}

@HyperApp({
  name: "Deep Nesting App",
  modules: [Level1Module],
  logs: {
    modules: true,
    controllers: true,
    routes: true,
  },
})
class DeepApp {}

const PORT = 3023;

describe("Deep Nesting Registration", () => {
  it("should correctly register app -> module -> module -> controller", async () => {
    const app = await createApplication(DeepApp);
    await app.listen(PORT);

    try {
      // 1. Verify with getAppTree (Metadata check)
      const tree = getAppTree(DeepApp);
      expect(tree.modules["Level1Module"]).toBeDefined();
      expect(tree.modules["Level1Module"].modules["Level2Module"]).toBeDefined();
      expect(
        tree.modules["Level1Module"].modules["Level2Module"].controllers[
          "DeepController"
        ]
      ).toBeDefined();
      
      const fullPath = "/level1/level2/deep/hello";
      expect(tree.paths[fullPath]).toBeDefined();

      // 2. Verify with actual HTTP request (Runtime check)
      const body = await request(fullPath, undefined, PORT);
      expect(JSON.parse(body).message).toBe("hello from the depths");
    } finally {
      await app.close();
    }
  }, 15000);
});
