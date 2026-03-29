import "../src"
import axios from "axios";

async function request() {
   try { const url = "http://localhost:8085";
   const payload = __sys__.$read(".private/payload.json");
   const headers = {
       "Content-Type": "application/json",
   };
   const response = await axios.post(url, payload, {
       headers,
   });
   console.log(response);
    
   } catch (error) {
    console.error(error.response.data);
   }
}


request();