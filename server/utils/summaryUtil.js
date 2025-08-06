
// Generate voice summaries
function generateVoiceSummaries(foodList, limit = 10) {
  
  return foodList.slice(0, limit).map(item => {
    return `${item.name}`;
  });
}


// Generate detailed summary for a single food item
function generateDetailedSummary(foodItem) {
  return `${foodItem.name}: A ${foodItem.vegetarian ? 'vegetarian' : 'non-vegetarian'} ${foodItem.type} that is ${foodItem.spicy ? 'spicy' : 'mild'}. It has ${foodItem.calories} calories, costs $${foodItem.price}, and takes ${foodItem.preparationTime} minutes to prepare. Description: ${foodItem.description}`;
}

export { generateVoiceSummaries, generateDetailedSummary };