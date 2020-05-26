// import fetch library so we can make API calls
const fetch = require("node-fetch");

// import auth function from helper file
const authTableau = require("./tableau");

exports.handler = async (event) => {
  // extract the body from the event. The event is the payload Tableau sends to the Lambda function. This payload contains meta-data about the webhook that was fired off.
  const bodyToParse = JSON.parse(event.body);
  const site_luid = bodyToParse.site_luid;
  const resource_name = bodyToParse.resource_name;
  const resource_luid = bodyToParse.resource_luid;
  const created_at = bodyToParse.created_at;
  const event_type = bodyToParse.event_type;

  // create REST API authentication body to sign in and get token. Here we're using the env. variables. You can set these in the AWS Lambda Console.
  const server = process.env.TABLEAUSERVER;
  const site = process.env.TABLEAUSITE;
  const paName = process.env.PATNAME;
  const paTokenSecret = process.env.PATSECRET;
  const message = process.env.MESSAGE;
  const url = `${server}/api/3.8/auth/signin`;
  const postBody = {
    credentials: {
      personalAccessTokenName: paName,
      personalAccessTokenSecret: paTokenSecret,
      site: {
        contentUrl: site,
      },
    },
  };

  const setDataQualityWarning = async (authToken) => {
    try {
      // first check if there is already a data quality warning set
      const dataQualityUrl = `${server}api/3.8/sites/${site_luid}/dataQualityWarnings/datasource/${resource_luid}`;
      const getDataQualityWarning = await fetch(dataQualityUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Tableau-Auth": authToken,
        },
      });
      const getIdQualityWarning = await getDataQualityWarning.json();
      // this checks if there are already data quality warnings on this asset. If so, it returns undefined and we go to the second step in the IF block.
      const gotWarning =
        getIdQualityWarning.dataQualityWarningList.dataQualityWarning !==
        undefined
          ? true
          : false;
      // if there is a dataquality warning we need to send a PUT request, else a POST request
      if (gotWarning) {
        const id =
          getIdQualityWarning.dataQualityWarningList.dataQualityWarning[0].id;
        const fetchUrl = `${server}api/3.8/sites/${site_luid}/dataQualityWarnings/${id}/`;
        console.log("Updating the data quality warning of the asset...");
        const queryToPut = await fetch(fetchUrl, {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Tableau-Auth": authToken,
          },
          body: JSON.stringify({
            dataQualityWarning: {
              type: "deprecated",
              isActive: "true",
              message: message,
              isSevere: "true",
            },
          }),
        });
        const responseData = await queryToPut.json();
        return responseData;
      } else {
        console.log("We need to create a data quality warning!");
        const postUrl = `${server}api/3.8/sites/${site_luid}/dataQualityWarnings/datasource/${resource_luid}`;
        const queryToPost = await fetch(postUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Tableau-Auth": authToken,
          },
          body: JSON.stringify({
            dataQualityWarning: {
              type: "deprecated",
              isActive: "true",
              message,
              isSevere: "true",
            },
          }),
        });
        const responseData = await queryToPost.json();
        return responseData;
      }
    } catch (error) {
      console.log("Got an error", error);
    }
  };

  const removeDataQualityWarning = async (authToken) => {
    try {
      const deleteUrl = `${server}api/3.8/sites/${site_luid}/dataQualityWarnings/datasource/${resource_luid}`;
      const queryToDelete = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Tableau-Auth": authToken,
        },
      });
      const responseData = await queryToDelete.json();
      return responseData;
    } catch (error) {
      console.log("Got error", error);
    }
  };

  // always call the login function to get a token
  const datafromLoginPromise = await authTableau(url, postBody);

  //   check for the event type. We have failed or succeeded
  if (event_type === "DatasourceRefreshFailed") {
    // if there is a failure, run this
    console.log(
      "We are now going to create or update the data quality warning",
      created_at
    );
    const datafromDataQualityWarningPut = await setDataQualityWarning(
      datafromLoginPromise.credentials.token
    );
    console.log(
      "Output from data quality creation:",
      datafromDataQualityWarningPut
    );
  } else if (event_type === "DatasourceRefreshSucceeded") {
    // if there is no failure, run this
    console.log(
      "We are now going to remove the data quality warning, if there is any",
      created_at
    );
    const datafromRemoveDataQualityWarning = await removeDataQualityWarning(
      datafromLoginPromise.credentials.token
    );
    console.log(
      "Output from data quality removal:",
      datafromRemoveDataQualityWarning
    );
  }
};
