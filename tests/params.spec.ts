// import "reflect-metadata";
// import { describe, it } from "mocha";
// import { strictEqual, ok } from "node:assert";
// import { METADATA_STATE_KEYS } from "../src/__internals/constants";

// import {
//   Get,
//   HyperApp,
//   HyperModule,
//   Param,
//   Body,
//   Query,
//   HyperController,
//   Post,
//   Req,
//   Res,
// } from "../src/decorators";
// import { request } from "./helpers";
// import { Server } from "hyper-express";

// @HyperController("/")
// class UserController {
//   @Get("/:id")
//   user() {
//     console.log(`User: ${id}`);
//   }

//   @Post("/")
//   createUser(@Body() body: any, req, res) {
//     console.log(`Body`, body);
//   }

//   @Get("/query")
//   query(@Query() query: any, @Res req: any) {
//     console.log(`Query`, req);
//   }
// }

// @HyperModule({
//   path: "/users",
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

 
// server.set_not_found_handler((req, res) => {
//   res.status(404).send("Not Found");
// });

// describe("params: Params Test ", () => {
//   before(async () => {
//     await server.listen(3001);
//     console.log("Server is running on port 3001");
//   });

//   it("params: seay hello", async function () {
//     ok(true);
//   });

//   it("params: should inject params", async function () {
//     const response = await request("/test/users/randy");
//     console.log(`Response: ${response}`);
//     ok(response);
//   });

//   it("params: shuold inject body", async function () {
//     const response = await request("/test/users", {
//       name: "randy",
//     });

//     console.log(response);
//     ok(response);
//   });

//   it("params: shuold inject query", async function () {
//     const response = await request("/test/users/query?name=randy");
//     ok(response);
//   });

//   // test("params: should inject params", async function () {
//   //   const response = await new Promise<string>((resolve) => {
//   //     server.listen(3001, () => {
//   //       fetch("http://0.0.0.0:3001/test/users/randy")
//   //         .then((res) => res.text())
//   //         .then(resolve);
//   //     });
//   //   });

//   //   strictEqual(response, "randy");
//   // });

//   // test("params: shuold inject body", async function () {

//   //   const response = await new Promise<string>((resolve) => {
//   //     server.listen(3001, () => {
//   //       fetch("http://0.0.0.0:3001/test/users/", {
//   //         method: "POST",
//   //         body: JSON.stringify({ name: "randy" }),
//   //         headers: {
//   //           "Content-Type": "application/json",
//   //         },
//   //       })
//   //         .then((res) => res.json())
//   //         .then(resolve);
//   //       })
//   //   });

//   //   console.log(response);

//   // });
// });
