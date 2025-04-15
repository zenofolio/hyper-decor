import { Request } from "hyper-express/types";
import { createCustomRequestDecorator } from "./Http";
import { buffer } from "stream/consumers";
import HyperFileException from "../exeptions/HyperFileException";

/**
 * File upload restrictions
 *
 * @param allowedMimeTypes Allowed MIME types
 * @param maxFileSize Maximum file size in bytes
 *
 */
export interface FileUplopadRestrictions {
  allowedMimeTypes: string[];
  maxFileSize: number;
}

/**
 * File restrictions resolver
 *
 * @param request Request object
 * @returns File restrictions
 *
 */
export type FileRestrictions =
  | FileUplopadRestrictions
  | ((
      request: Request
    ) => FileUplopadRestrictions | Promise<FileUplopadRestrictions>);

/**
 * File decorator options
 *
 * @param fieldName Field name to extract from the request
 * @param restrictions File restrictions
 * @param required If the file is required
 *
 *
 */
export interface FileOptions {
  fieldName: string | string[];
  restrictions?: FileRestrictions;
  required?: boolean;
}

export interface UploadedFile {
  name: string;
  filename: string;
  mimeType: string;
  size: number;
  ext: string;
  buffer: Buffer;
}

/**
 * Decorator to extract file from the request
 *
 * @param param0
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
    const fileSize = Number(request.headers?.["content-length"]);
    const isMultipart = contentType?.includes("multipart/form-data");

    if (!isMultipart) {
      throw new HyperFileException(
        "Invalid request, expected multipart form data",
        {
          fieldName: _options.fieldName,
        }
      );
    }

    if (isNaN(fileSize) || fileSize <= 0) {
      throw new HyperFileException(
        `File ${_options.fieldName} is missing or empty`,
        {
          fieldName: _options.fieldName,
          fileSize,
        }
      );
    }

    if (!passSize && fileSize > maxFileSize) {
      throw new HyperFileException(
        `File ${_options.fieldName} is too large. Max size is ${maxFileSize} bytes`,
        {
          fieldName: _options.fieldName,
          maxFileSize,
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
      : files[_options.fieldName];
  });
};

/**
 *
 * Helper function to create a file decorator with options
 *
 * @param options
 * @returns
 */
File.options = (options: FileOptions, required: boolean = false) => {
  return (fieldName: string | string[]) => {
    return File({ ...options, required, fieldName });
  };
};

/**
 * Helper function to create a file decorator with restrictions
 *
 * @param restrictions
 * @returns
 */
File.restrictions = (restrictions: FileRestrictions) => {
  return (fieldName: string | string[], required: boolean = false) => {
    return File({ fieldName, restrictions, required });
  };
};

/////////////////////////////
// Types
/////////////////////////////

/////////////////////////////
/// Utility
/////////////////////////////

const resolveRestrictions = async (
  request: Request,
  restrictions?: FileRestrictions
): Promise<FileUplopadRestrictions> => {
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
 * Extract files from a request with validation, transformation, and required files check.
 *
 * @param request
 * @param options Validation and transformation options
 * @returns Transformed or raw file details
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
  const contentType = request.headers?.["content-type"];

  if (!contentType?.includes("multipart/form-data")) {
    throw new Error("Invalid request, expected multipart form data");
  }

  const filesMap = {} as any;

  await request.multipart(async (field) => {
    if (field.file && field.file.stream) {
      const bufferFile = await buffer(field.file.stream);

      const type = await (
        await import("file-type")
      ).fileTypeFromBuffer(bufferFile);

      if (!type) {
        throw new HyperFileException(`Invalid file type`, {
          field: field.name,
        });
      }

      const mimeType = type.mime;
      const extention = type.ext;

      // Validate MIME type early
      if (options?.mimeTypes && !options.mimeTypes.includes(mimeType)) {
        throw new HyperFileException(
          `Invalid file type, only ${options.mimeTypes.join(", ")} is allowed`,
          {
            field: field.name,
            allowedMimeTypes: options.mimeTypes,
            mimeType,
          }
        );
      }

      if (!type) {
        throw new HyperFileException(`Invalid file type`, {
          field: field.name,
        });
      }

      if (options?.maxSize && bufferFile.byteLength > options.maxSize) {
        throw new HyperFileException(
          `File '${field.name}' size exceeds the maximum limit of ${options.maxSize} bytes`,
          {
            field: field.name,
            maxSize: options.maxSize,
          }
        );
      }

      if (options?.requireName && !field.file?.name) {
        throw new HyperFileException(`File name is required`, {
          field: field.name,
        });
      }

      // Derive file details
      const name = field.file?.name?.split(".").shift() ?? field.name;
      const filename = `${name?.replace(extention, "")}.${extention}`;

      (filesMap as any)[field.name] = {
        field: field.name,
        name: name,
        filename: filename,
        ext: extention,
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
