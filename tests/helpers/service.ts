import { HyperService } from "../../src";

@HyperService()
export class UserService {
  constructor() {
    console.log("UserService");
  }

  hello() {
    return "hello";
  }
}
