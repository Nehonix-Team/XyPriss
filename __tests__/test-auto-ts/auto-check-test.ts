// this file was auto created while testing FW

interface User {
    id: number;
    name: string;
    email: string;
}

function createUser(name: string, email: string): User {
    return {
        id: Math.floor(Math.random() * 1000),
        name,
        email
    };
}

export const user = createUser("John Doe", "john@example.com");
console.log("User created:", user);
