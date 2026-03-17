import "reflect-metadata";

class UserDto {
    name: string;
}

class Test {
    async test(): Promise<UserDto> {
        return { name: "zeno" };
    }
}

console.log("ReturnType:", Reflect.getMetadata("design:returntype", Test.prototype, "test"));
