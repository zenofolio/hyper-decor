export interface OpenAPIDocument {
  openapi: string;
  info: Info;
  paths: Paths;
  components?: Components;
  security?: SecurityRequirement[];
  tags?: Tag[];
}

export interface Info {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: Contact;
  license?: License;
  version: string;
}

export interface Contact {
  name?: string;
  url?: string;
  email?: string;
}

export interface License {
  name: string;
  url?: string;
}

export interface Paths {
  [path: string]: PathItem;
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  head?: Operation;
  options?: Operation;
  trace?: Operation;
}

export interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: Tag[];
  parameters?: OpenApiParameter[];
  requestBody?: RequestBody;
  responses: OpenApiResponses;
  security?: SecurityRequirement[];
}

export interface OpenApiParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema: Schema;
}

export interface RequestBody {
  description?: string;
  content: {
    [mediaType: string]: MediaType;
  };
}

export interface MediaType {
  schema: Schema;
}

export interface OpenApiResponses {
  [statusCode: string]: OpenApiResponse;
}

export interface OpenApiResponse {
  description: string;
  content?: {
    [mediaType: string]: MediaType;
  };
  headers?: { [name: string]: Header };
}

export interface Header {
  description?: string;
  required?: boolean;
  schema: Schema;
}

export interface Schema {
  type: string;
  format?: string;
  items?: Schema;
  properties?: { [key: string]: Schema };
  additionalProperties?: boolean;
  example?: any;
}

export interface SecurityRequirement {
  [securityScheme: string]: string[];
}

export interface Tag {
  name: string;
  description?: string;
}

export interface Components {
  schemas?: { [schemaName: string]: Schema };
  responses?: { [responseName: string]: OpenApiResponse };
  parameters?: { [parameterName: string]: OpenApiParameter };
  securitySchemes?: { [schemeName: string]: SecurityScheme };
}

export interface SecurityScheme {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  in?: "header" | "query" | "cookie";
  name?: string;
  scheme?: string;
  bearerFormat?: string;
  openIdConnectUrl?: string;
  oauth2?: OAuth2Scheme;
}

export interface OAuth2Scheme {
  authorizationUrl: string;
  tokenUrl: string;
  refreshUrl?: string;
  scopes: { [scope: string]: string };
}
