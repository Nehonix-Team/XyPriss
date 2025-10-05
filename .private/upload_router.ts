import { Router } from "../src";
import { uploadSingle, uploadFields } from "../src/file-upload";

const uploader_router = Router()

// Now we can safely use app.uploadSingle since it's available immediately
uploader_router.post("/upload", uploadSingle("file"), (req: any, res) => {
    console.log(
        "File received:",
        req.file
            ? {
                  fieldname: req.file.fieldname,
                  originalname: req.file.originalname,
                  encoding: req.file.encoding,
                  mimetype: req.file.mimetype,
                  size: req.file.size,
              }
            : "No file"
    );

    if (req.file) {
        res.json({
            success: true,
            message: "File uploaded successfully",
            file: {
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
            },
        });
    } else {
        res.status(400).json({
            success: false,
            message: "No file uploaded",
        });
    }
});


export {uploader_router}