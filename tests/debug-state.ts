import "reflect-metadata";
import { 
  HyperApp, 
  HyperModule, 
  HyperController, 
  Get, 
  Res, 
  Response,
  createApplication,
  Req,
  Request
} from "../src";
import { container } from "tsyringe";

@HyperController("/state")
class StateController {
  @Get("/")
  async test(@Req() req: Request, @Res() res: Response) {
    try {
      console.log("HANDLER: HIT /state/");
      
      // Check if methods exist
      console.log("HANDLER: req.setValue exists?", typeof req.setValue);
      console.log("HANDLER: req.getValue exists?", typeof req.getValue);

      req.setValue("test_key", "test_value");
      const val = req.getValue("test_key");
      console.log("HANDLER: val =", val);

      req.setValue("obj", { name: "zeno" });
      const obj = req.getValue<{ name: string }>("obj");
      console.log("HANDLER: obj =", obj);

      res.json({
        val,
        obj,
        success: true
      });
    } catch (err: any) {
      console.error("HANDLER ERROR:", err);
      res.status(500).send(err.message);
    }
  }
}

@HyperModule({
  controllers: [StateController]
})
class StateModule { }

@HyperApp({
  modules: [StateModule]
})
class App { }

async function run() {
  try {
    container.reset();
    const port = 3055;
    console.log("Booting App...");
    const app = await createApplication(App);
    console.log("App created, starting listener...");
    await app.listen(port);
    console.log(`Server listening on port ${port}`);

    try {
      console.log(`Fetching http://127.0.0.1:${port}/state/ ...`);
      const resp = await fetch(`http://127.0.0.1:${port}/state/`);
      console.log("Response status:", resp.status);
      const text = await resp.text();
      console.log("Response text:", text);
      
      if (text) {
          const data = JSON.parse(text);
          console.log("Parsed data:", data);
          if (data.val === "test_value" && data.success) {
              console.log("✅ REQUEST STATE TEST PASSED");
          } else {
              console.log("❌ REQUEST STATE TEST FAILED: Unexpected data");
          }
      } else {
          console.log("❌ REQUEST STATE TEST FAILED: Empty response");
      }
    } catch (e) {
      console.error("❌ FETCH ERROR:", e);
    } finally {
      console.log("Closing app...");
      await app.close();
    }
  } catch (e) {
    console.error("❌ BOOT ERROR:", e);
  } finally {
    process.exit(0);
  }
}

run();
