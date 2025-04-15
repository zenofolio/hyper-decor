//////////////////////////////
/// Types constants
//////////////////////////////
export const KEY_TYPE_APP = "hyper:type:app";
export const KEY_TYPE_CONTROLLER = "hyper:type:controller";
export const KEY_TYPE_MODULE = "hyper:type:module";
export const KEY_TYPE_ROUTE = "hyper:type:route";
export const KEY_TYPE_SERVICE = "hyper:type:service";
export const KEY_TYPE_GUARD = "hyper:type:guard";

export type KeyTypes =
  | typeof KEY_TYPE_APP
  | typeof KEY_TYPE_CONTROLLER
  | typeof KEY_TYPE_MODULE
  | typeof KEY_TYPE_SERVICE
  | typeof KEY_TYPE_ROUTE;

//////////////////////////////
/// Params constants
//////////////////////////////

export const KEY_PARAMS_APP = "hyper:type:app";
export const KEY_PARAMS_CONTROLLER = "hyper:type:controller";
export const KEY_PARAMS_MODULE = "hyper:type:module";
export const KEY_PARAMS_ROUTE = "hyper:type:route";
export const KEY_PARAMS_PARAM = "hyper:type:param";
export const KEY_PARAMS_MIDDLEWARES = "hyper:type:middlewares";
export const KEY_PARAMS_SCOPE = "hyper:type:scope";
export const KEY_PARAMS_ROLE = "hyper:type:role";
export const KEY_PARAMS_PASS = "hyper:type:pass";

export type KeyParams =
  | typeof KEY_PARAMS_APP
  | typeof KEY_PARAMS_CONTROLLER
  | typeof KEY_PARAMS_MODULE
  | typeof KEY_PARAMS_ROUTE
  | typeof KEY_PARAMS_PARAM
  | typeof KEY_PARAMS_MIDDLEWARES
  | typeof KEY_PARAMS_SCOPE
  | typeof KEY_PARAMS_ROLE
  | typeof KEY_PARAMS_PASS;

//////////////////////////////
/// State constants
//////////////////////////////

export const KEY_STATE_UPDATED = "hyper:state:updated";
export const KEY_STATE_CREATED = "hyper:state:created";
export const KEY_STATE_PREPARED = "hyper:state:prepared";
export const KEY_STATE_BY_PASS = "hyper:state:bypass";

export type KeyState =
  | typeof KEY_STATE_UPDATED
  | typeof KEY_STATE_CREATED
  | typeof KEY_STATE_PREPARED;

//////////////////////////////
/// Metadata constants
//////////////////////////////

export const DESIGN_PARAMTYPES = "design:paramtypes";
export const DESIGN_RETURNTYPE = "design:returntype";
export const DESIGN_TYPE = "design:type";

export type DesignKeys =
  | typeof DESIGN_PARAMTYPES
  | typeof DESIGN_RETURNTYPE
  | typeof DESIGN_TYPE;

export const METADATA_HYPER_TYPE = {
  APP: "hyper:app",
  CONTROLLER: "hyper:controller",
  MODULE: "hyper:module",
  ROUTE: "hyper:route",
  PARAM: "hyper:param",
};

export const METADATA_KEYS = {
  APP_INFO: "hyper:app:info",
  MODULES: "hyper:modules",
  PREFIX: "hyper:prefix",
  CONTROLLERS: "hyper:controllers",
  ROUTES: "hyper:routes",
  ROLES: "hyper:roles",
  SCOPES: "hyper:scopes",
  SCOPED: "hyper:scoped",
  MIDDLEWARES: "hyper:middleware",
};

export const METADATA_STORE_KEYS = {
  PARAMS: "hyper:store:params",
};

export const METADATA_METHOD_KEYS = {
  ARGUMENTS: "hyper:arguments",
  ARGUMENTS_NAMES: "hyper:arguments:names",
  ARGUMENTS_TYPE: "hyper:arguments:type",
};

export const METADATA_PARAMS_KEYS = {
  DESIGN_PARAM_TYPES: "design:paramtypes",
  DESIGN_TYPE: "design:type",
  DESIGN_RETURN_TYPE: "design:type",
};

export const METADATA_STATE_KEYS = {
  UPDATED: "hyper:updated",
  CREATED: "hyper:created",
  PREPARED: "hyper:prepared",
};

export const FULL_ACCESS = "*";
