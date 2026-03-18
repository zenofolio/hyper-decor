import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  Get,
  HyperApp,
  HyperController,
  HyperModule,
  createApplication,
  Scope,
  Role,
  Middleware,
} from "../src";
import { setRole, setScopes } from "../src/common/helpers";
import { fetch } from "undici";

// --- Mock Auth Middleware ---
const MockAuth = (req: any, res: any, next: any) => {
  const roles = req.header("x-roles")?.split(",").map((r: string) => r.trim());
  const scopes = req.header("x-scopes")?.split(",").map((s: string) => s.trim());

  if (roles) setRole(req, roles);
  if (scopes) setScopes(req, scopes);

  next();
};

@HyperController({ path: "/secure" })
@Middleware(MockAuth)
class SecureController {
  
  @Get("/roles")
  @Role(["admin", "editor"])
  async testRoles() {
    return { ok: true, access: "roles" };
  }

  @Get("/scopes")
  @Scope(["profile:read", "profile:write"])
  async testScopes() {
    return { ok: true, access: "scopes" };
  }

  @Get("/public")
  async testPublic() {
    return { ok: true, access: "public" };
  }

  @Get("/mixed")
  @Role("user")
  @Scope("profile:read")
  async testMixed() {
    return { ok: true, access: "mixed" };
  }
}

@HyperController({ path: "/admin" })
@Middleware(MockAuth)
@Role("admin") // Level 1: Controller must have admin
class AdminController {
  @Get("/delete")
  @Scope("db:delete") // Level 2: Method must have db:delete
  async deleteItem() {
    return { ok: true, access: "deleted" };
  }
}

@HyperModule({
  controllers: [SecureController, AdminController],
})
class SecurityModule { }

@HyperApp({
  modules: [SecurityModule],
})
class SecurityApp { }

describe("Security Enforcement (Functional)", () => {
  let app: any;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createApplication(SecurityApp);
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${app.port}`;
    console.log(`[TEST] Base URL: ${baseUrl}, Port: ${app.port}`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Role Enforcement (OR logic)", () => {
    it("should allow access if user has ONE of the required roles", async () => {
      const res = await fetch(`${baseUrl}/secure/roles`, {
        headers: { "x-roles": "editor" }
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ access: "roles" });
    });

    it("should deny access if user has none of the required roles", async () => {
      const res = await fetch(`${baseUrl}/secure/roles`, {
        headers: { "x-roles": "guest" }
      });
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.error).toContain("Only admin, editor can access this resource");
    });
  });

  describe("Scope Enforcement (AND logic)", () => {
    it("should allow access ONLY if user has ALL required scopes", async () => {
      const res = await fetch(`${baseUrl}/secure/scopes`, {
        headers: { "x-scopes": "profile:read, profile:write" }
      });
      expect(res.status).toBe(200);
    });

    it("should deny access if one scope is missing", async () => {
      const res = await fetch(`${baseUrl}/secure/scopes`, {
        headers: { "x-scopes": "profile:read" }
      });
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.error).toMatch(/forbidden|scopes|role/i);
    });
  });

  describe("Full Access (*)", () => {
    it("should allow access to anything if user has '*' role", async () => {
      const res = await fetch(`${baseUrl}/secure/roles`, {
        headers: { "x-roles": "*" }
      });
      expect(res.status).toBe(200);
    });

    it("should allow access to anything if user has '*' scope", async () => {
      const res = await fetch(`${baseUrl}/secure/scopes`, {
        headers: { "x-scopes": "*" }
      });
      expect(res.status).toBe(200);
    });
  });

  describe("Hierarchical Enforcement (Additive)", () => {
    it("should allow access if BOTH controller and method requirements are met", async () => {
      const res = await fetch(`${baseUrl}/admin/delete`, {
        headers: { 
          "x-roles": "admin",
          "x-scopes": "db:delete"
        }
      });
      expect(res.status).toBe(200);
    });

    it("should deny access if controller requirement is not met", async () => {
      const res = await fetch(`${baseUrl}/admin/delete`, {
        headers: { 
          "x-roles": "user",
          "x-scopes": "db:delete"
        }
      });
      expect(res.status).toBe(403);
    });

    it("should deny access if method requirement is not met", async () => {
      const res = await fetch(`${baseUrl}/admin/delete`, {
        headers: { 
          "x-roles": "admin",
          "x-scopes": "db:read"
        }
      });
      expect(res.status).toBe(403);
    });
  });

  describe("Public Access", () => {
    it("should allow access to public routes without headers", async () => {
      const res = await fetch(`${baseUrl}/secure/public`);
      expect(res.status).toBe(200);
    });
  });

  describe("Direct Routes on App/Module (Isolated)", () => {
    @HyperController("/direct-ctrl")
    class DirectController {
      @Get("/")
      async index() { return { ok: true, source: "controller" }; }
    }

    @HyperModule({
      path: "/mod",
      controllers: [DirectController]
    })
    @Middleware(MockAuth)
    @Role("module-admin")
    class DirectModule {
      @Get("/module-route")
      async moduleRoute() { return { ok: true, source: "module" }; }
    }

    @HyperApp({
      modules: [DirectModule]
    })
    @Middleware(MockAuth)
    class DirectApp {
      @Get("/app-route")
      async appRoute() { return { ok: true, source: "app" }; }
    }

    let directApp: any;
    let directUrl: string;

    beforeAll(async () => {
      directApp = await createApplication(DirectApp);
      await directApp.listen(0);
      directUrl = `http://127.0.0.1:${directApp.port}`;
    });

    afterAll(async () => {
      await directApp.close();
    });

    it("should allow access to direct route on App", async () => {
      const res = await fetch(`${directUrl}/app-route`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ source: "app" });
    });

    it("should allow access to direct route on Module with correct role", async () => {
      const res = await fetch(`${directUrl}/mod/module-route`, {
        headers: { "x-roles": "module-admin" }
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ source: "module" });
    });

    it("should deny access to direct route on Module without correct role", async () => {
      const res = await fetch(`${directUrl}/mod/module-route`, {
        headers: { "x-roles": "user" }
      });
      expect(res.status).toBe(403);
    });

    it("should allow access to controller within the module", async () => {
      // Must also have module-admin role because it's inherited!
      const res = await fetch(`${directUrl}/mod/direct-ctrl`, {
        headers: { "x-roles": "module-admin" }
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ source: "controller" });
    });
  });
});
