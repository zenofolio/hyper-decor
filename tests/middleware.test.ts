// import { describe, test } from "mocha";
// import { ok } from "assert";

// import {
//   createApplication,
//   Get,
//   HyperApp,
//   HyperController,
//   HyperModule,
//   injectable,
//   Middleware,
//   MiddlewareNext,
//   Request,
//   Response,
// } from "../src";

// @injectable()
// class NameService {
//   async getName() {
//     return "John Doe";
//   }
// }

// @injectable()
// class TestMiddleware {
//   constructor(private nameService: NameService) {}

//   async handle(request: Request, response: Response, next: MiddlewareNext) {
//     console.log(`Middleware: ${await this.nameService.getName()}`);
//     next();
//   }
// }

// @Middleware(TestMiddleware, async (request: Request, response: Response, next: MiddlewareNext) => {
//   console.log("Middleware: app:admin");
//   next();
// })
// @Middleware()
// @HyperController()
// class TestController {
//   @Get("info")
//   async info(request: Request, response: Response) {
//     return response.json({ message: "Hello World" });
//   }
// }

// @HyperModule({
//   path: "/test",
//   controllers: [TestController],
// })
// class TestModule {}

// @HyperApp({
//   modules: [TestModule],
// })
// class App {
//   onPrepare() {}
// }

// describe("Middleware", () => {
//   let app: any;

//   // Create the application and listen on port 3000
//   before(async () => {
//     app = await createApplication(App);
//     await app.listen(3000);
//   });

//   // Close the application
//   after(async () => {
//     await app.close();
//   });

//   test("middleware: should have middleware 'app:admin'", async () => {
//     const data = await fetch("http://0.0.0.0:3000/test/info").then((res) =>
//       res.json()
//     );

//     ok(data.message === "Hello World");
//   });
// });
