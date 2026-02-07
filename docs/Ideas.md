Find scanner API/app that can fill in values in foodstores

- Also need alert for items running low on. This needs to be baked into the logic for the shopping list too, if its's not already
- Need way to add ingredient amount actually used on recipe modal main screen. Would be idea if the fields were editable here and then carry over to the confirmation page
	- Also would be helpful to have the recipe instructions on the recipe modal. Have wrestled with this a bit but this is clearly the better choice from what I've seen
- I just ran a log and deduct on new york strip and it appears it didn't adjust inventory because it couldn't match what was there. How do we fix this so new recipes don't always mean adding new parsing language? Assuming that's what the problem was here. Is it possible to keep a list of inventory items in an index and then have these fields autocomplete?
- Need a command for manually deducting items without added a meal to the log. Or add a "snack" category/meal type and allow tagging them as such. I'd have to make new snack recipes or we'd have to implement indexing ingredients
- Need a new modal system for manually creating new recipes
