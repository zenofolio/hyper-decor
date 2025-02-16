import { Response } from "hyper-express";
import {
  createApplication,
  HyperApp,
  HyperController,
  HyperModule,
  Res,
  Post,
  File,
  UploadedFile,
} from "../src";

/**
 * HyperController for testing
 */
@HyperController()
class StorageController {
  @Post("upload")
  async upload(@File("file") file: UploadedFile, @Res() res: Response) {
    res.status(201).json({
      size: file.size,
      name: file.name,
      filename: file.filename,
      mimeType: file.mimeType,
      ext: file.ext,
    });
  }
}

/**
 * StorageModule for testing
 */
@HyperModule({
  path: "storage",
  controllers: [StorageController],
})
class StorageModule {}

/**
 * App for testing
 */
@HyperApp({
  name: "App",
  description: "App description",
  version: "1.0.0",
  modules: [StorageModule],
})
class App {
  onPrepare() {}
}

async function main() {
  const app = await createApplication(App);

  app.set_error_handler((req, res, err) => {
    console.error(err);
    res.status(500).json({ message: err.message });
  });

  app.listen(3000, () => {
    console.log(`Server is running on http://localhost:3000`);
  });
}

main();
