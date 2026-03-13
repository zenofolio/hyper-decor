import { Request } from "hyper-express/types";
import { createCustomRequestDecorator } from "./Http";
import HyperFileException from "../exeptions/HyperFileException";

/**
 * File upload restrictions
 */
export interface FileUploadRestrictions {
  allowedMimeTypes: string[];
  maxFileSize: number;
}

/**
 * File restrictions resolver
 */
export type FileRestrictions =
  | FileUploadRestrictions
  | ((
      request: Request
    ) => FileUploadRestrictions | Promise<FileUploadRestrictions>);

/**
 * File decorator options
 */
export interface FileOptions {
  fieldName: string | string[];
  restrictions?: FileRestrictions;
  required?: boolean;
}

export interface UploadedFile {
  field: string;
  name: string;
  filename: string;
  mimeType: string;
  size: number;
  extension: string;
  buffer: Buffer;
}

/**
 * Decorator to extract file from the request
 */
export const File = (options: FileOptions | string) => {
  const _options =
    typeof options === "string" ? { fieldName: options } : options;

  return createCustomRequestDecorator("File", async (request) => {
    const { allowedMimeTypes, maxFileSize } = await resolveRestrictions(
      request,
      _options.restrictions
    );

    const passTypes =
      allowedMimeTypes.includes("*") || allowedMimeTypes.length === 0;
    const passSize = maxFileSize === Infinity;

    const contentType = request.headers?.["content-type"];
    const isMultipart = contentType?.includes("multipart/form-data");

    if (!isMultipart) {
      throw new HyperFileException(
        "Invalid request, expected multipart form data",
        {
          fieldName: _options.fieldName,
        }
      );
    }

    const files = await extractFiles(request, {
      maxSize: passSize ? undefined : maxFileSize,
      mimeTypes: passTypes ? undefined : allowedMimeTypes,
      requires: _options.required
        ? Array.isArray(_options.fieldName)
          ? _options.fieldName
          : [_options.fieldName]
        : undefined,
      requireName: true,
    });

    return Array.isArray(_options.fieldName)
      ? files
      : files[_options.fieldName as string];
  });
};

File.options = (options: FileOptions, required: boolean = false) => {
  return (fieldName: string | string[]) => {
    return File({ ...options, required, fieldName });
  };
};

File.restrictions = (restrictions: FileRestrictions) => {
  return (fieldName: string | string[], required: boolean = false) => {
    return File({ fieldName, restrictions, required });
  };
};

const resolveRestrictions = async (
  request: Request,
  restrictions?: FileRestrictions
): Promise<FileUploadRestrictions> => {
  if (typeof restrictions === "function") {
    return await restrictions(request);
  }

  return (
    restrictions ?? {
      allowedMimeTypes: ["*"],
      maxFileSize: Infinity,
    }
  );
};

/**
 * Extract files from a request with validation and secure streaming.
 */
const extractFiles = async <T extends string>(
  request: Request,
  options?: {
    maxSize?: number;
    mimeTypes?: string[];
    requires?: T[];
    requireName?: boolean;
  }
): Promise<Record<T, UploadedFile>> => {
  const filesMap = {} as any;

  // Track if we are already over total limit (Content-Length check as first line of defense)
  const totalLength = Number(request.headers?.["content-length"]);
  if (options?.maxSize && !isNaN(totalLength) && totalLength > options.maxSize + 1024 * 10) { // Buffer for boundaries
      // Content-Length is significantly larger than allowed file size
      // We don't throw yet because multipart might have multiple files or large fields
  }

  await request.multipart(async (field) => {
    if (field.file && field.file.stream) {
      const chunks: Buffer[] = [];
      let totalRead = 0;

      // Safe stream reading with early exit
      for await (const chunk of field.file.stream) {
        totalRead += chunk.length;
        
        if (options?.maxSize && totalRead > options.maxSize) {
           throw new HyperFileException(
            `File '${field.name}' exceeds the maximum limit of ${options.maxSize} bytes`,
            { field: field.name, maxSize: options.maxSize }
          );
        }
        chunks.push(chunk);
      }

      const bufferFile = Buffer.concat(chunks);
      const { fileTypeFromBuffer } = await import("file-type");
      const type = await fileTypeFromBuffer(bufferFile);

      const mimeType = type?.mime || "unknown/unrecognized";
      const extension = type?.ext || "bin";

      // Validate MIME type early if unrecognized
      if (!type && options?.mimeTypes && options.mimeTypes.length > 0) {
         throw new HyperFileException(
          `Invalid file type for field '${field.name}'. Could not recognize file signature. Expected one of: ${options.mimeTypes.join(", ")}`,
          { field: field.name, allowedMimeTypes: options.mimeTypes }
        );
      }

      // Validate MIME type if recognized
      if (options?.mimeTypes && !options.mimeTypes.includes(mimeType)) {
        throw new HyperFileException(
          `Invalid file type for field '${field.name}'. Expected: ${options.mimeTypes.join(", ")}, Received: ${mimeType}`,
          {
            field: field.name,
            allowedMimeTypes: options.mimeTypes,
            receivedMimeType: mimeType,
          }
        );
      }

      if (options?.requireName && !field.file?.name) {
        throw new HyperFileException(`File name is required for field '${field.name}'`, {
          field: field.name,
        });
      }

      // Secure filename resolution
      const rawName = field.file?.name || field.name;
      // Sanitize: remove null bytes, path traversal sequences, and extract base name
      const sanitizedBase = rawName.replace(/\0/g, "").split(/[\\/]/).pop() || "file";
      const nameOnly = sanitizedBase.includes(".") 
        ? sanitizedBase.substring(0, sanitizedBase.lastIndexOf("."))
        : sanitizedBase;
      
      const filename = `${nameOnly}.${extension}`;

      filesMap[field.name] = {
        field: field.name,
        name: nameOnly,
        filename: filename,
        extension: extension,
        size: bufferFile.byteLength,
        mimeType: mimeType,
        buffer: bufferFile,
      };
    }
  });

  // Check for required files
  if (options?.requires) {
    for (const required of options.requires) {
      if (!filesMap[required]) {
        throw new HyperFileException(`File "${required}" is required`, {
          required,
        });
      }
    }
  }

  return filesMap;
};
