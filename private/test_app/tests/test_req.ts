import guestApiService from "../req.axios";

const res = await guestApiService.post("/auth/login", {
    data: {
        email: "test",
        password: "test",
    },
});

console.log("Auth response: ", res);

