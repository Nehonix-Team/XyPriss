import { Router } from "../src";
import { app } from "./upload_serv";

const uploader_router = Router()


app.post("/upload", app.uploadSingle("file"), (req: any, res) => {
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