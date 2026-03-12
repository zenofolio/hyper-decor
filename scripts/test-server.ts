import "reflect-metadata";
import {
  HyperApp,
  HyperModule,
  HyperService,
  HyperController,
  Get,
  Post,
  Res,
  Body,
  Response,
  OnInit,
  createApplication,
  Transform,
} from "../src";
import { injectable } from "tsyringe";

// 1. Setup a Mock Transformer (Zod-like)
const ZodTransformer = {
  transform: ({ data, schema }: any) => {
    if (schema._type === "zod") {
      return { ...data, parsed: true, timestamp: Date.now() };
    }
    return data;
  },
};

const mockSchema = { _type: "zod" };

@injectable()
@HyperService()
class AnalyticsService implements OnInit {
  async onInit() {
    console.log("Service initialized");
  }
}

@HyperController("/api")
class MainController {
  @Get("/status")
  status(@Res() res: Response) {
    res.json({ status: "alive" });
  }

  @Post("/user")
  @Transform(mockSchema)
  createUser(@Body() data: any) {
    return data;
  }
}

@HyperModule({
  imports: [AnalyticsService],
  controllers: [MainController]
})
class MainModule { }

@HyperApp({
  name: "Standalone Test App",
  version: "1.0.0",
  modules: [MainModule]
})
class FullApp { }

async function run() {
  console.log("Starting App...");
  const app = await createApplication(FullApp);
  app.useTransform(ZodTransformer);

  const port = 3010;
  await app.listen(port);
  console.log(`Server listening on http://localhost:${port}`);

  // Close after 5 seconds
  setTimeout(async () => {
    console.log("Closing server...");
    await app.close();
    process.exit(0);
  }, 5000);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
