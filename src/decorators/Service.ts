import { container } from "tsyringe";

interface ServiceOptions {
  singleton?: boolean;
}

export const Service = ({
  singleton = true,
}: ServiceOptions): ClassDecorator => {
  return (target: any) => {
    const instance = container.resolve(target);

    if (singleton) {
      container.registerInstance(target, instance);
    }

    return function (...args: any[]) {
      return instance;
    } as any;
  };
};
