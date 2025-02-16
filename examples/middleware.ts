import { Response } from "hyper-express";
import {
  createApplication,
  HyperApp,
  HyperController,
  HyperModule,
  Res,
  Post,
  File,
  UploadedFile,
  Get,
  Body,
  Middleware,
  Put,
  Delete,
} from "../src";


// we can use middleware at method level directly
@HyperController("v1")
class V1Controller {
  @Get()
  async index(@Res() res: Response) {
    res.send("Hello");
  }

  @Post("create")
  @Middleware((req, res, next) => {
    console.log("Create method middleware");
    next();
  })
  async create(@Body() body: any, @Res() res: Response) {
    res.status(201).json(body);
  }
}


// This middleware will be only applied 
// to the update method in V2Controller
@HyperController("v2")
@Middleware.only(/update/, (req, res, next) => {
  console.log("Update method middleware");
  next();
})
class V2Controller {
  @Get()
  async index(@Res() res: Response) {
    res.send("Hello");
  }

  @Put("update")
  async update(@Body() body: any, @Res() res: Response) {
    res.status(201).json(body);
  }

  @Delete("delete")
  async delete(@Body() body: any, @Res() res: Response) {
    res.status(201).json(body);
  }
}

/**
 * StorageModule for testing
 */
@HyperModule({
  path: "storage",
  controllers: [V1Controller,V2Controller],
})
class SimpleModule {}

/**
 * App for testing
 */
@HyperApp({
  name: "App",
  description: "App description",
  version: "1.0.0",
  modules: [SimpleModule],
})
class App {
  onPrepare() {}
}

async function main() {
  const app = await createApplication(App);

  app.set_error_handler((req, res, err) => {
    console.error(err);
    res.status(500).json({ message: err.message });
  });

  app.listen(3000, () => {
    console.log(`Server is running on http://localhost:3000`);
  });
}

main();
