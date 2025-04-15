import { Service } from "../../src";

@Service()
export class UserService {
  constructor() {
    console.log("UserService");
  }

  hello() {
    return "hello";
  }
}
