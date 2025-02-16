import { Response, Server } from "hyper-express";
import {
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  Middleware,
  Role,
  Scope,
  Query,
  Res,
  Param,
  Post,
  Body,
} from "../../src/decorators";

abstract class CRUD<ID extends string | number = string> {
  index(req: Request, res: Response): Promise<void> {
    throw new Error("Method not implemented.");
  }

  find(id: ID, req: Request, res: Response): Promise<void> | void {
    throw new Error("Method not implemented.");
  }

  create(request: Request, res: Response): Promise<void> | void {
    throw new Error("Method not implemented.");
  }

  update(id: ID, req: Request, res: Response): Promise<void> | void {
    throw new Error("Method not implemented.");
  }

  delete(id: ID, req: Request, res: Response): Promise<void> | void {
    throw new Error("Method not implemented.");
  }
}

/////////////////////////////////////
/// TestController | HyperController
////////////////////////////////////

@Middleware((req, res, next) => {
  console.log(`Controller level middleware`);
  next();
})
@HyperController("unit")
class TestController extends CRUD<string> {
  @Middleware((req, res, next) => {
    console.log(`Method level middleware`);
    next();
  })
  @Get("/")
  async index(@Query() query: any, @Res() res: Response) {
    res.send("hello");
  }

  @Get("/list")
  @Scope([
    {
      scope: "users:read",
      description: "Allow login user to read users",
      message: "Only authorized account can read users",
    },
  ])
  listUsers(req: Request, res: Response) {
    res.send("user.list");
  }

  @Post("/details/:id")
  find(
    @Param("id") id: string,
    @Body() body: any,
    @Res() response: Response
  ): Promise<void> | void {
    response.send(body.name);
  }
}

///////////////////////////////
/// HyperModule | CRUDModule
//////////////////////////////

@Middleware((req, res, next) => {
  console.log(`Module level middleware`);
  next();
})
@HyperModule({
  path: "/test",
  name: "CRUD Module",
  controllers: [TestController],
})
class CRUDModule {}

@Middleware((req, res, next) => {
  console.log(`App level middleware`);
  next();
})
@HyperApp({
  name: "Hyper Express Decorators",
  version: "1.0.0",
  description: "Decorators to make express development easier",
  modules: [CRUDModule],
  prefix: "/api",
})
export class Application {
  onPrepare() {
    console.log("Application is prepared");
  }
}
