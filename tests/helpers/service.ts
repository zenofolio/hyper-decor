import { injectable } from "tsyringe";

@injectable()
export class Service {
  hello() {
    return "hello"
  }
}