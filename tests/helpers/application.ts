import { Response } from "hyper-express";
import {
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  Middleware,
  Scope,
  Post,
  Req,
  Res,
  Query,
  Body,
  Param,
  IsSingleton,
  OnInit,
} from "../../src/decorators";
import { IHyperApplication } from "../../src/type";
import { injectable } from "tsyringe";

abstract class CRUD<ID extends string | number = string> {
  index(req: Request, res: Response): Promise<void> {
    throw new Error("Method not implemented.");
  }

  find(id: ID, req: Request, res: Response): Promise<void> | void {
    throw new Error("Method not implemented.");
  }

  @Scope("roles:admin")
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

@injectable()
class UserService implements IsSingleton, OnInit {
  isSingleton(): boolean {
    return true;
  }

  async onInit(): Promise<any> {
    console.log("initiated");
  }

  constructor() {
    console.log("UserService created");
  }

  async name() {
    return "John Doe";
  }
}

@Scope("controller:unit")
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
  @Scope("users:read")
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

@Scope("module:crud")
@Middleware((req, res, next) => {
  console.log(`Module level middleware`);
  next();
})
@HyperModule({
  path: "/test",
  name: "CRUD Module",
  controllers: [TestController],
  imports: [UserService],
})
class CRUDModule {}

@Scope("app:admin")
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
  imports: [UserService],
})
export class Application implements IHyperApplication {
  onPrepare() {
    console.log("This method will be called after the app is prepared");
  }
}
