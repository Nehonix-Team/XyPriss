import * as crypto from "node:crypto";
const privateKeyHex =
    "302e020100300506032b6570042204209e313d8086c485206e5f74673a77df2105929b6134e8acdd36445a0b931747fd";
const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyHex, "hex"),
    format: "der",
    type: "pkcs8",
}); 
const data =
    "xypriss-swagger:1.0.22:/home/idevo/Documents/projects/XyPriss/mods/swagger";
const signature = crypto
    .sign(undefined, Buffer.from(data), privateKey)
    .toString("hex");
console.log(signature);
