// // import { createServer } from "http";

// const hostname = "127.0.0.1";
// const port = 3001;

// import { Server, Request, Response } from "hyper-express";
// import {
//   Get,
//   Query,
//   HyperApp,
//   HyperController,
//   HyperModule,
//   Res,
// } from "../src/decorators";

// @HyperController("/")
// class UserController {
//   @Get()
//   async index(@Query query: any, @Res response: Response) {
//     const randomString = Math.random().toString(36).substring(7);

//     response.json({
//       name: randomString,
//       email: `${randomString}@gmail.com`,
//     });
//   }
// }

// @HyperModule({
//   path: "/",
//   controllers: [UserController],
// })
// class Module {}

// @HyperApp({
//   prefix: "/test",
//   modules: [Module],
//   logger: (...args: any[]) => console.log(args),
// })
// class App extends Server {}

// const server = new App();

// server.listen(3001).then(() => {
//   console.log("Server is running on port http://localhost:3001/test/");
// });

// // const server = App();

// // server.get("/test/", (res) => {
// //   const randomString = Math.random().toString(36).substring(7);

// //   res.end(`${randomString}`);
// // });

// // server.listen(port, (token) => {
// //   console.log(`Server is running on port http://localhost:${port}/test/`);
// // });

