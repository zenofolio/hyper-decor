import "reflect-metadata";
import { Server } from "hyper-express";

import {
  KEY_PARAMS_APP,
  KEY_PARAMS_MIDDLEWARES,
  KEY_PARAMS_PASS,
  KEY_PARAMS_ROLE,
  KEY_PARAMS_SCOPE,
  KEY_TYPE_APP,
} from "../__internals/constants";

import { IHyperAppTarget } from "../type";
import { DecoratorHelper } from "../__internals/decorator-base";
import { mergeMetadata } from "../__internals/helpers/merge-metadata";
import { HyperAppMetadata, HyperAppDecorator, LogSpaces } from "./types";
import { prepareApplication } from "../__internals/helpers/prepare.helper";

/**
 * Decorator to define the main application class with assigned modules.
 * @param modules - List of modules to be used in the application.
 */

export const HyperApp: HyperAppDecorator = (options) =>
  DecoratorHelper<HyperAppMetadata, IHyperAppTarget>(
    {
      type: KEY_TYPE_APP,
      key: KEY_PARAMS_APP,
      options: options ?? { modules: [] },
    },
    (options, Target) => {
      return class extends Server {
        private listArguments: any[] = [];
        private storeLogs: Record<string, string[]> = {};

        constructor(...args: any[]) {
          super(options.options);
          this.listArguments = args;
        }

        async prepare() {
          this.mergeMetadata(Target);
          await this.applyOptions(Target);
        }

        /** Fusiona los metadatos relevantes al Target */
        private mergeMetadata(targetPrototype: any) {
          mergeMetadata(targetPrototype, this.constructor, [
            KEY_PARAMS_MIDDLEWARES,
            KEY_PARAMS_SCOPE,
            KEY_PARAMS_ROLE,
            KEY_PARAMS_PASS,
          ]);
        }

        /** Aplica las opciones y prepara la instancia del Target */
        private async applyOptions(Target: any) {
          await prepareApplication(options, Target, this, this.log.bind(this));
          const target = Reflect.construct(Target, this.listArguments);
          (target as any)?.onPrepare?.();
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
