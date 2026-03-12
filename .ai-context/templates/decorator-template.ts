/**
 * {{DecoratorName}} Decorator Template
 * 
 * Description: {{description}}
 * Author: {{author}}
 * Created: {{date}}
 */

import { DECORATOR_METADATA_KEY } from '../__internals/constants';
import { DecoratorType } from '../__internals/types';

/**
 * Options interface for {{DecoratorName}} decorator
 */
export interface {{DecoratorName}}Options {
  /**
   * Optional description or configuration
   */
  description?: string;
  
  /**
   * Validation rules (if applicable)
   */
  validation?: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object';
  };
  
  /**
   * Transform function (if applicable)
   */
  transform?: (value: any) => any;
}

/**
 * {{DecoratorName}} decorator
 * 
 * Usage:
 * ```typescript
 * class ExampleController {
 *   @Get('/')
 *   example(@{{DecoratorName}}() param: string) {
 *     return { param };
 *   }
 * }
 * ```
 * 
 * @param options - Configuration options for the decorator
 */
export function {{DecoratorName}}(options?: {{DecoratorName}}Options) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    parameterIndex?: number
  ) {
    // Get existing metadata or initialize
    const existingMetadata = Reflect.getMetadata(DECORATOR_METADATA_KEY, target, propertyKey) || {};
    
    // Create decorator metadata
    const decoratorMetadata = {
      type: DecoratorType.PARAMETER, // or METHOD, CLASS as appropriate
      decoratorName: '{{DecoratorName}}',
      options: options || {},
      parameterIndex,
      target: target.constructor.name,
      propertyKey: propertyKey?.toString(),
      timestamp: new Date().toISOString()
    };
    
    // Store metadata
    if (parameterIndex !== undefined) {
      // Parameter decorator
      const parameters = existingMetadata.parameters || [];
      parameters[parameterIndex] = decoratorMetadata;
      existingMetadata.parameters = parameters;
    } else if (propertyKey) {
      // Method decorator
      existingMetadata.method = decoratorMetadata;
    } else {
      // Class decorator
      existingMetadata.class = decoratorMetadata;
    }
    
    // Save updated metadata
    Reflect.defineMetadata(DECORATOR_METADATA_KEY, existingMetadata, target, propertyKey);
    
    // Additional decorator logic here
    // e.g., validation, transformation, middleware registration
  };
}

// Export for type checking and testing
export type {{DecoratorName}}Decorator = typeof {{DecoratorName}};