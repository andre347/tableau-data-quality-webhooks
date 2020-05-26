const fetch = require("node-fetch");

const authTableau = async (url, postBody) => {
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(postBody),
    });
    const json = await resp.json();
    return json;
  } catch (error) {
    console.log("Got an error", error);
  }
};

module.exports = authTableau;
