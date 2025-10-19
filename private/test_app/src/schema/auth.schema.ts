import { Interface } from "fortify-schema";

const login = Interface({
  identifier: "number",
  password: "string!",
});

const register = Interface({
  username: "string(/^(?=.*[a-zA-Z])[a-zA-Z0-9_-]{6,20}$/)",
  email: "email",
  password: "password",
  password_confirmation: "string!",
});

const authSchema = {
  login,
  register,
};

export default authSchema;
