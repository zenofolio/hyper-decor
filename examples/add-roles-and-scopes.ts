import { MiddlewareHandler, Response } from "hyper-express";
import {
  Body,
  createApplication,
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  Query,
  Res,
  Scope,
  Post,
  setRole,
  setScopes,
  Middleware,
  Role,
} from "../src";





/**
 * Middleware to set role and scopes
 *
 * @param req
 * @param res
 * @param next
 */
const middlewarew: MiddlewareHandler = (req, res, next) => {
  req.setRoleScopes("SUPERVISOR", ["READ"]);

  // use helper function
  setRole(req, "SUPERVISOR");
  setScopes(req, ["READ"]);
};




/**
 * TestController for testing
 *
 */
@HyperController("v1")
class TestController {
  @Get("list")
  @Scope(["READ"])
  async list(@Query() filters: any, @Res() res: Response) {
    res.json({ message: "Hello", filters });
  }

  @Post()
  @Scope({
    scope: "CREATE",
    description: "Allow login user to create user",
    message: "Has no permission to create user",
  })
  async create(@Body() body: any, @Res() res: Response) {
    res.status(201).json(body);
  }
}




/**
 * UserModule for testing
 */
@HyperModule({
  path: "user",
  controllers: [TestController],
})
@Role("SUPERVISOR")
class UserModule {}



/**
 * Attaching middleware to App
 * the middleware will set role and scopes
 */
@HyperApp({
  name: "App",
  description: "App description",
  version: "1.0.0",
  modules: [UserModule],
})
@Middleware(middlewarew)
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
