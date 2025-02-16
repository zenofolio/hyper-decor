import "reflect-metadata";
import createRouteDecorator from "../__internals/creators/routes.creator";

export const Get = createRouteDecorator("get");
export const Post = createRouteDecorator("post");
export const Put = createRouteDecorator("put");
export const Delete = createRouteDecorator("delete");
export const Patch = createRouteDecorator("patch");
export const Options = createRouteDecorator("options");
export const Head = createRouteDecorator("head");
export const Trace = createRouteDecorator("trace");
export const Any = createRouteDecorator("any");
export const All = createRouteDecorator("all");
export const Connect = createRouteDecorator("connect");
export const WS = createRouteDecorator("ws");
export const Upgrade = createRouteDecorator("upgrade");
