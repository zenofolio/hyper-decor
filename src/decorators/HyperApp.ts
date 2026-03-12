import "reflect-metadata";
import { Server } from "hyper-express";
import { container } from "tsyringe";

import {
  KEY_PARAMS_APP,
  KEY_PARAMS_MIDDLEWARES,
  KEY_PARAMS_PASS,
  KEY_PARAMS_ROLE,
  KEY_PARAMS_SCOPE,
  KEY_TYPE_APP,
} from "../__internals/constants";

import { IHyperAppTarget, IHyperApp } from "../type";
import { DecoratorHelper } from "../__internals/decorator-base";
import { mergeMetadata } from "../__internals/helpers/merge-metadata";
import { HyperAppMetadata, HyperAppDecorator, LogSpaces, Constructor } from "./types";
import { transformRegistry, TransformerInput } from "../__internals/transform/transform.registry";
import { prepareApplication } from "../__internals/helpers/prepare.helper";

export const HyperApp: HyperAppDecorator = (options) =>
  DecoratorHelper<HyperAppMetadata, IHyperAppTarget>(
    {
      type: KEY_TYPE_APP,
      key: KEY_PARAMS_APP,
      options: {
        modules: [],
        logger: console.log,
        ...options,
      },
    },
    (options, Target) => {
      return class extends Server {
        private listArguments: unknown[] = [];
        private storeLogs: Record<string, string[]> = {};

        constructor(...args: unknown[]) {
          super(options.options);
          this.listArguments = args;
        }

        /** Registers an agnostic transformer (Zod, Joi, etc.) */
        useTransform(transformer: TransformerInput): IHyperApp<this> {
          transformRegistry.register(transformer);
          return this as any;
        }

        async prepare() {
          container.registerInstance(Server, this);
          this.mergeMetadata(Target);
          await this.applyOptions(Target);
        }

        /** Fusiona los metadatos relevantes al Target */
        private mergeMetadata(targetPrototype: Constructor | Function) {
          mergeMetadata(targetPrototype, this.constructor, [
            KEY_PARAMS_MIDDLEWARES,
            KEY_PARAMS_SCOPE,
            KEY_PARAMS_ROLE,
            KEY_PARAMS_PASS,
          ]);
        }

        /** Aplica las opciones y prepara la instancia del Target */
        private async applyOptions(Target: Constructor) {
          await prepareApplication(options, Target, this, this.log.bind(this));
          const target = Reflect.construct(Target, this.listArguments);
          if (target && typeof target === 'object' && 'onPrepare' in target) {
            (target as any).onPrepare();
          }
          this.showLogs();
        }

        /** Maneja los logs respetando las opciones configuradas */
        private log(space: keyof LogSpaces, message: string) {
          if (options.logs?.[space] === false) return;
          (this.storeLogs[space] ||= []).push(`- ${message}`);
        }

        private showLogs() {
          const content = ["\n\n"];

          content.push("/////////////////////////////");
          content.push(`- HyperExpress Application`);
          content.push(
            `- ${options.name ?? "Hyper App"} - ${options.version ?? "1.0.0"}`
          );
          content.push("/////////////////////////////\n");

          content.push("\nLogs:");

          Object.entries(this.storeLogs).forEach(([space, logs]) => {
            if (!logs.length) return;
            content.push(`- [${space.toUpperCase()}]`);
            logs.forEach((log) => content.push(`  ${log}`));
            content.push("");
          });

          options.logger?.call(this, content.join("\n"));
          this.storeLogs = {};
        }
      };
    }
  );

//////////////////////////////////
/// Private methods
//////////////////////////////////
