// import { describe, test } from "mocha";

// import HyperExpress, {
//   MiddlewareNext,
//   Request,
//   Response,
//   Server,
// } from "hyper-express";

// import {
//   Get,
//   Post,
//   HyperApp,
//   HyperController,
//   HyperModule,
//   Middleware,
//   Role,
//   Scope,
// } from "../src/decorators";

// // Middleware function example
// const logMiddleware = (req: Request, res: Response, next: MiddlewareNext) => {
//   next();
// };

// abstract class Controller {
//   @Get()
//   index(req: Request, res: Response): Promise<void> {
//     throw new Error("Method not implemented.");
//   }

//   @Get("/details/:id")
//   find(req: Request, res: Response): Promise<void> {
//     throw new Error("Method not implemented.");
//   }

//   @Post("/create")
//   create(req: Request, res: Response): Promise<void> {
//     throw new Error("Method not implemented.");
//   }

//   abstract onInit?(router: 1): void;
// }

// @HyperController("/templates")
// class TemplatesController extends Controller {
//   onInit?(router: 1): void {
//     throw new Error("Method not implemented.");
//   }
// }

// // Define a controller with routes
// @HyperController()
// @Middleware(logMiddleware) // Apply middleware to the entire controller
// class UserController {
//   @Role("admin")
//   @Scope("read:users")
//   @Get()
//   getUsers(req: Request, res: Response) {
//     console.log("Getting users...");
//     res.end("USERS");
//   }

//   @Scope("read:users")
//   @Get("/:id")
//   getUser(req: Request, res: Response) {
//     res.end("USER");
//   }

//   //   @Post("/create")
//   //   @Role("admin")
//   //   @Scope(["write:users", "create:users"])
//   //   createUser(req: Request, res: Response) {
//   //     res.json({ message: "User created successfully!" });
//   //   }
// }

// // Define a module with a prefix and controllers
// @HyperModule({
//   path: "/users",
//   controllers: [UserController, TemplatesController],
// })
// @Middleware((req, res, next) => {
//   next();
// })
// class UserModule {}

// // Define the main application with modules
// @HyperApp({
//   modules: [UserModule],
//   logger: console,
// })
// class MyApp extends Server {
//   @Get()
//   welcome(req: Request, res: Response) {
//     res.json({ message: "Welcome to the app!" });
//   }
// }

// describe("HyperApp", () => {
//   test("app: should create an application with modules and controllers", async () => {
//     const app = new MyApp();

//     await new Promise<void>((resolve) => {
//       (app as Server).listen(3001, () => {
//         fetch("http://0.0.0.0:3001/users/1")
//           .then((e) => e.text())
//           .then((res) => {
//             resolve();
//           });
//       });
//     });
//   });
// });
