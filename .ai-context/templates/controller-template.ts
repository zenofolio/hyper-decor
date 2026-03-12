/**
 * Controller Template for hyper-decor
 * 
 * This template shows how to create a complete REST API controller
 * using hyper-decor decorators with proper TypeScript typing.
 */

import { 
  HyperController, 
  Get, 
  Post, 
  Put, 
  Delete,
  Middleware,
  Role,
  Scope 
} from '../../src';
import { Request, Response } from 'hyper-express';

// Example interfaces for type safety
interface {{EntityName}} {
  id: number;
  name: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Create{{EntityName}}Dto {
  name: string;
  email?: string;
}

interface Update{{EntityName}}Dto {
  name?: string;
  email?: string;
}

/**
 * {{EntityName}} Controller
 * 
 * Provides CRUD operations for {{EntityName}} entities
 */
@HyperController('/{{entityName}}s')
export class {{EntityName}}Controller {
  
  /**
   * Get all {{entityName}}s
   */
  @Get('/')
  @Role('user') // Optional: require user role
  @Scope('{{entityName}}:read') // Optional: require specific scope
  async findAll(
    @Query() query: any,
    @Res() response: Response
  ): Promise<{{EntityName}}[]> {
    // Implementation here
    const {{entityName}}s: {{EntityName}}[] = [
      {
        id: 1,
        name: 'Example {{EntityName}}',
        email: 'example@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    response.json({{entityName}}s);
  }
  
  /**
   * Get {{entityName}} by ID
   */
  @Get('/:id')
  @Role('user')
  @Scope('{{entityName}}:read')
  async findOne(
    @Param('id') id: number,
    @Res() response: Response
  ): Promise<{{EntityName}} | null> {
    // Implementation here
    const {{entityName}}: {{EntityName}} = {
      id,
      name: `{{EntityName}} ${id}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    response.json({{entityName}});
  }
  
  /**
   * Create new {{entityName}}
   */
  @Post('/')
  @Role('admin') // Require admin role for creation
  @Scope('{{entityName}}:create')
  @Middleware(validateCreateDto) // Custom validation middleware
  async create(
    @Body() createDto: Create{{EntityName}}Dto,
    @Res() response: Response
  ): Promise<{{EntityName}}> {
    // Implementation here
    const new{{EntityName}}: {{EntityName}} = {
      id: Math.floor(Math.random() * 1000),
      ...createDto,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    response.status(201).json(new{{EntityName}});
  }
  
  /**
   * Update {{entityName}}
   */
  @Put('/:id')
  @Role('admin')
  @Scope('{{entityName}}:update')
  async update(
    @Param('id') id: number,
    @Body() updateDto: Update{{EntityName}}Dto,
    @Res() response: Response
  ): Promise<{{EntityName}}> {
    // Implementation here
    const updated{{EntityName}}: {{EntityName}} = {
      id,
      name: 'Updated Name',
      ...updateDto,
      createdAt: new Date('2023-01-01'), // Keep original
      updatedAt: new Date() // Update timestamp
    };
    
    response.json(updated{{EntityName}});
  }
  
  /**
   * Delete {{entityName}}
   */
  @Delete('/:id')
  @Role('admin')
  @Scope('{{entityName}}:delete')
  async remove(
    @Param('id') id: number,
    @Res() response: Response
  ): Promise<void> {
    // Implementation here
    // Soft delete or hard delete logic
    
    response.status(204).send();
  }
}

// Example middleware function
function validateCreateDto(req: Request, res: Response, next: Function) {
  const { name } = req.body;
  
  if (!name || typeof name !== 'string') {
    return res.status(400).json({
      error: 'Name is required and must be a string'
    });
  }
  
  next();
}