import "reflect-metadata";

type Constructor<T = any> = new (...args: any[]) => T;

export class MixinBuilder<
  TClass extends Constructor<any>,
  Type = InstanceType<TClass>,
> {
  constructor(private __class: TClass) {}

  mix<NClass extends Constructor<any>>(
    clazz: NClass
  ): MixinBuilder<NClass & TClass> {
    return new MixinBuilder<NClass & TClass>(Mix(this.__class, clazz as any));
  }

  build() {
    return this.__class;
  }

  construct(...args: any[]): Type {
    return new this.__class(...args);
  }

  ////////////////////////////
  /// Static methods
  ////////////////////////////

  static mix<NClass extends Constructor<any>>(clazz: NClass) {
    return new MixinBuilder<NClass>(clazz as any);
  }
}

const Mix = <T extends Constructor<any>>(a: T, b: T): T => {
  return class extends a {
    constructor(...args: any[]) {
      super(...args);
      Object.assign(this, new b(...args));
      console.log(a)
    }
  };
};
