import "reflect-metadata";

function MyDec() {
    return (target: any) => target;
}

class Service {}

@MyDec()
class Controller {
    constructor(public s: Service) {}
}

console.log("Paramtypes:", Reflect.getMetadata("design:paramtypes", Controller));
