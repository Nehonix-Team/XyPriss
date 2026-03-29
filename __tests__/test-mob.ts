import axios from "axios";

const url = "http://localhost:3001/api";

async function call() {
    try {
        const res = await axios.get(url);
        console.log("response for testing: ", res.data);
    } catch (error) {
        console.log("Error while testing: ", error.response.data);
    }
}

call();

