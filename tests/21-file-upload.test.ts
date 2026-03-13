import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  HyperApp,
  HyperModule,
  HyperController,
  Post,
  File,
  UploadedFile,
  createApplication,
} from "../src";
import { request, FormData } from "undici";

@HyperController("/upload")
class UploadController {
  @Post("/single")
  async single(@File("avatar") file: UploadedFile) {
    return {
      field: file.field,
      name: file.name,
      filename: file.filename,
      extension: file.extension,
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  @Post("/restricted")
  async restricted(
    @File({
      fieldName: "document",
      restrictions: {
        allowedMimeTypes: ["application/pdf"],
        maxFileSize: 1024 * 5, // 5KB
      },
      required: true,
    })
    file: UploadedFile
  ) {
    return { ok: true, filename: file.filename };
  }
}

@HyperModule({
  controllers: [UploadController],
})
class UploadModule {}

@HyperApp({
  modules: [UploadModule],
})
class UploadApp {}

describe("File Decorator (Ultra Secure & Indestructible)", () => {
  let app: any;
  const port = 3018;
  const baseUrl = `http://127.0.0.1:${port}`;

  beforeAll(async () => {
    app = await createApplication(UploadApp);
    await app.listen(port);
  });

  afterAll(async () => {
      if (app) await app.close();
  });

  it("should upload a file and return correct metadata", async () => {
    const form = new FormData();
    // Valid PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const content = Buffer.concat([pngSignature, Buffer.from("hello world")]);
    const blob = new Blob([content], { type: "image/png" });
    form.append("avatar", blob, "my-photo.png");

    const res = await request(`${baseUrl}/upload/single`, {
      method: "POST",
      body: form,
    });

    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(200);
    expect(data.field).toBe("avatar");
    expect(data.name).toBe("my-photo");
    expect(data.filename).toBe("my-photo.png");
    expect(data.extension).toBe("png");
    expect(data.size).toBe(content.length);
    expect(data.mimeType).toBe("image/png");
  });

  it("should sanitize dangerous filenames", async () => {
      const form = new FormData();
      // Valid JPEG/JFIF signature: FF D8 FF
      const jpegSignature = Buffer.from([0xff, 0xd8, 0xff]);
      const content = Buffer.concat([jpegSignature, Buffer.from("payload")]);
      const blob = new Blob([content], { type: "image/jpeg" });
      form.append("avatar", blob, "../../../etc/passwd.jpg");

      const res = await request(`${baseUrl}/upload/single`, {
          method: "POST",
          body: form,
      });

      const data = (await res.body.json()) as any;
      expect(res.statusCode).toBe(200);
      expect(data.filename).toBe("passwd.jpg");
      expect(data.name).toBe("passwd");
  });

  it("should block files exceeding size limit (streaming check)", async () => {
    const form = new FormData();
    // Valid PDF signature: 25 50 44 46
    const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46]);
    const largeContent = Buffer.concat([pdfSignature, Buffer.alloc(1024 * 6, "a")]); // > 5KB
    const blob = new Blob([largeContent], { type: "application/pdf" });
    form.append("document", blob, "large.pdf");

    const res = await request(`${baseUrl}/upload/restricted`, {
      method: "POST",
      body: form,
    });

    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(400); 
    expect(data.error).toContain("exceeds the maximum limit");
  });

  it("should block invalid MIME types", async () => {
    const form = new FormData();
    // Valid PNG signature
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const content = Buffer.concat([pngSignature, Buffer.from("not a pdf")]);
    const blob = new Blob([content], { type: "image/png" });
    form.append("document", blob, "fake.pdf");

    const res = await request(`${baseUrl}/upload/restricted`, {
      method: "POST",
      body: form,
    });

    const data = (await res.body.json()) as any;
    expect(res.statusCode).toBe(400);
    expect(data.error).toContain("Expected: application/pdf");
  });
});
