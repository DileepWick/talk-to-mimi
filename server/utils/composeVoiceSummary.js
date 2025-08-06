import {
  getFilteredFoods,
  getFoodByName,
} from "../controllers/foodController.js";

import {
  generateVoiceSummaries,
  generateDetailedSummary,
} from "./summaryUtil.js";

async function composeVoiceSummary(result, message) {
  let filterFoodsData = result;
  let combinedMessage = null;
  const defaultSummary = "No Data Available";

  if (result?.intent === "filter_food") {
    filterFoodsData = await getFilteredFoods(result);
    const foodListSummary = filterFoodsData.length > 0 ? generateVoiceSummaries(filterFoodsData) : defaultSummary;
    combinedMessage = ` User asked  : "${message}" .\n System :- Foods that aligned with the user's preferences : ${foodListSummary}.`;
  } else if (result?.intent === "get_food_by_name") {
    filterFoodsData = await getFoodByName(result.name);
    const detailed = filterFoodsData.length > 0 ? generateDetailedSummary(filterFoodsData[0]): defaultSummary;
    combinedMessage = `User asked: "${message}".\n System :- Details for "${result.name}": ${detailed}`;
  } else if (result?.intent === "general_query") {
    combinedMessage = ` User asked: "${message}" System :- This is a general query about food . Mimi responds accordingly.`;
  } else if (result?.intent === "vague_query") {
    combinedMessage = `User asked: "${message}" System : It seems like the question is mispronounced or unclear.`;
  }

  return {
    summary: combinedMessage,
    data: filterFoodsData,
  };
}

export default composeVoiceSummary;
