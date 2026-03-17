import { Schema } from '../types';

/**
 * 🔍 Extracts a basic OpenAPI schema from a DTO class.
 * This is a fallback when no specific transformer (Zod, etc.) is registered.
 */
export function collectSchema(Target: any): Schema {
    if (typeof Target !== 'function') {
        return { type: 'string' };
    }

    const schema: Schema = {
        type: 'object',
        properties: {},
    };

    // Note: Standard TS reflection doesn't expose fields without decorators.
    // However, we can try to instantiate or use metadata if available.
    // For now, we provide a placeholder that can be extended.
    
    // If it's a primitive constructor
    if (Target === String) return { type: 'string' };
    if (Target === Number) return { type: 'number' };
    if (Target === Boolean) return { type: 'boolean' };
    if (Target === Date) return { type: 'string', format: 'date-time' };

    return schema;
}
