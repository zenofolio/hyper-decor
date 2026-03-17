import 'reflect-metadata';

type MetadataRecord = Record<string, unknown>;
type PropertyKeyLike = string | symbol;

/**
 * Global Symbols for cross-package consistency
 */
const METADATA_STORE = Symbol.for('hyper:store');
const DISCOVERY_INDEX = Symbol.for('hyper:index');

const globalRegistry = globalThis as typeof globalThis & {
    [METADATA_STORE]?: WeakMap<object, MetadataRecord>;
    [DISCOVERY_INDEX]?: Set<object>;
};

/**
 * Global stores ensure that even different copies of the package
 * share the same metadata and discovery registry.
 */
const globalStore =
    globalRegistry[METADATA_STORE] ??
    (globalRegistry[METADATA_STORE] = new WeakMap<object, MetadataRecord>());

const globalIndex =
    globalRegistry[DISCOVERY_INDEX] ??
    (globalRegistry[DISCOVERY_INDEX] = new Set<object>());

export class Metadata {
    /**
     * Resolve the real metadata target.
     * If an instance is passed, use its constructor.
     */
    private static resolveTarget(target: object): object {
        return typeof target === 'function' ? target : target.constructor;
    }

    /**
     * Track class constructors for discovery.
     */
    private static track(target: object): void {
        if (typeof target === 'function') {
            globalIndex.add(target);
        }
    }

    /**
     * Get metadata for a target.
     * Auto-initializes the metadata object if missing.
     */
    static get<T = MetadataRecord>(target: object): T {
        const resolved = this.resolveTarget(target);

        let meta = globalStore.get(resolved);
        if (!meta) {
            meta = {};
            globalStore.set(resolved, meta);
            this.track(resolved);
        }

        return meta as T;
    }

    /**
     * Replace the full metadata object for a target.
     */
    static rawSet<T extends MetadataRecord>(target: object, value: T): void {
        const resolved = this.resolveTarget(target);
        globalStore.set(resolved, value);
        this.track(resolved);
    }

    /**
     * Create a scoped metadata accessor.
     */
    static prefix<TCommon extends object, TMember extends object>(name: string) {

        return {
            set: (
                target: object,
                propertyKey: PropertyKeyLike | undefined,
                data: Partial<TCommon> | Partial<TMember>
            ): void => {
                const root = Metadata.get<Record<string, any>>(target);
                const scoped = (root[name] ??= {});

                if (propertyKey === undefined) {
                    Object.assign((scoped.common ??= {}), data);
                    return;
                }

                const methods = (scoped.methods ??= {});
                Object.assign((methods[propertyKey] ??= {}), data);
            },

            get: (
                target: object,
                propertyKey?: PropertyKeyLike
            ): Partial<TCommon> | Partial<TMember> => {
                const root = Metadata.get<Record<string, any>>(target);
                const scoped = root[name] as
                    | {
                        common?: Partial<TCommon>;
                        methods?: Record<PropertyKeyLike, Partial<TMember>>;
                    }
                    | undefined;

                if (!scoped) {
                    return {} as Partial<TCommon> | Partial<TMember>;
                }

                if (propertyKey === undefined) {
                    return (scoped.common ??= {});
                }

                return scoped.methods?.[propertyKey] ?? {};
            },
        };
    }

    /**
     * Get all tracked classes.
     */
    static getTrackedClasses(): object[] {
        return [...globalIndex];
    }
}