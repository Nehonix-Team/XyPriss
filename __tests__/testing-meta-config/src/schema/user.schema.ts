import { Interface } from "fortify-schema";

export const userSchema = Interface({
  username: "username",
  email: "email",
  role: "user | admin",
  password: "password",
});
