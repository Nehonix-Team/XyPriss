import axios from "axios";

(async function () {
    try {
        const x = await (await axios.get("http://localhost:8085/.xJson")).data

        console.log(JSON.stringify(x));
    } catch (error) {
        console.log("error: ", error);
    }
})()


