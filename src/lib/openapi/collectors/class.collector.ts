import { Constructor } from '../../server/decorators/types';
import { SwaggerMeta } from '../metadata';

/**
 * 🏢 Extracts class-level OpenAPI metadata (Tags, Security, etc.)
 */
export function collectClassMetadata(Target: Constructor) {
    return SwaggerMeta.get(Target);
}
