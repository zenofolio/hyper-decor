// constants.ts

// OpenAPI Version
export const OPENAPI_VERSION = "3.0.0";

// Info Metadata (Información general sobre la API)
export const INFO_TITLE = "openapi:info:title";
export const INFO_DESCRIPTION = "openapi:info:description";
export const INFO_VERSION = "openapi:info:version";
export const INFO_TERMS_OF_SERVICE = "openapi:info:termsOfService";
export const INFO_CONTACT = "openapi:info:contact";
export const INFO_LICENSE = "openapi:info:license";

// Paths (Rutas de la API)
export const PATHS = "openapi:paths";
export const METHOD_GET = "openapi:method:get";
export const METHOD_POST = "openapi:method:post";
export const METHOD_PUT = "openapi:method:put";
export const METHOD_DELETE = "openapi:method:delete";
export const METHOD_PATCH = "openapi:method:patch";
export const METHOD_HEAD = "openapi:method:head";
export const METHOD_OPTIONS = "openapi:method:options";
export const METHOD_TRACE = "openapi:method:trace";

// Parameters (Parámetros de los métodos)
export const PARAMETERS = "openapi:parameters";
export const PARAM_NAME = "openapi:parameter:name";
export const PARAM_IN = "openapi:parameter:in"; // query, header, path, cookie
export const PARAM_REQUIRED = "openapi:parameter:required";
export const PARAM_DESCRIPTION = "openapi:parameter:description";
export const PARAM_SCHEMA = "openapi:parameter:schema";

// RequestBody (Cuerpo de la solicitud)
export const REQUEST_BODY = "openapi:requestBody";
export const REQUEST_BODY_DESCRIPTION = "openapi:requestBody:description";
export const REQUEST_BODY_CONTENT = "openapi:requestBody:content";

// Responses (Respuestas de los métodos)
export const RESPONSES = "openapi:responses";
export const RESPONSE_DESCRIPTION = "openapi:response:description";
export const RESPONSE_CONTENT = "openapi:response:content";
export const RESPONSE_SCHEMA = "openapi:response:schema";

// Security (Esquemas de seguridad)
export const SECURITY = "openapi:security";
export const SECURITY_SCHEME = "openapi:security:scheme"; // Esquemas de seguridad como apiKey, oauth2, etc.

// Tags (Etiquetas de los métodos)
export const TAGS = "openapi:tags";
export const TAG_NAME = "openapi:tag:name";
export const TAG_DESCRIPTION = "openapi:tag:description";

// Method Metadata (Metadatos adicionales de los métodos)
export const METHOD_METADATA = "openapi:method:metadata";
export const METHOD_SUMMARY = "openapi:method:summary";
export const METHOD_OPERATION_ID = "openapi:method:operationId";
export const METHOD_TAGS = "openapi:method:tags";

// Components (Componentes reutilizables)
export const COMPONENTS = "openapi:components";
export const COMPONENTS_SCHEMAS = "openapi:components:schemas"; // Esquemas reutilizables de parámetros y respuestas
export const COMPONENTS_RESPONSES = "openapi:components:responses"; // Respuestas reutilizables
export const COMPONENTS_PARAMETERS = "openapi:components:parameters"; // Parámetros reutilizables
export const COMPONENTS_SECURITY_SCHEMES = "openapi:components:securitySchemes"; // Esquemas de seguridad reutilizables

// Security Schemes (Esquemas de seguridad)
export const SECURITY_API_KEY = "openapi:security:apiKey";
export const SECURITY_OAUTH2 = "openapi:security:oauth2";
export const SECURITY_OIDC = "openapi:security:oidc"; // OpenID Connect
