import { getRandomBytes, Cipher, encrypt, decrypt } from "../index";

const k32 = getRandomBytes(32).toString();
const k16 = "c5e9718755f0053ada54ff716defe8bc";
const dec = "6db42b3d8fa3188530d1d4e8c2db28de:976cbc47e5fdff71a509a0dbcfbe9ecb";
console.log("key length (for 32 bytes): ", k32.length);
console.log("key output (for 32 bytes): ", k32);
console.log("key length (for 16 bytes): ", k16.length);
console.log("key output (for 16 bytes): ", k16);

console.log(encrypt("test", k16));
console.log(decrypt(dec, k16));
