Find scanner API/app that can fill in values in foodstores

- Calendar UI
	- Can't drag and drop items onto the next month days. You can try, and it prompts you for the meal category but doesn't actually add it after that
	- Days of the week above the calendar doesn't align with boxes of calendar, meaning it takes up half the space and isn't helpful. Need to lock it tot he calendar grid to be the same size so it always aligns
- Meal plan
	- Need some way to automate filling int he month and dates for each week. Maybe we just go through the next 5 years of calendars and normalize it for the whole period.
	- When you drag and drop items onto the calendar it appears to add new rows tot he meal tables. For example, the rows go in order vertically from Monday at top to Sunday at the bottom. I added some meals tot he calendar from the sidebar and it added and extra Sun row, an extra Mon row and an extra Thu row, in that order. This is happening all over though
	- Could consider offloading this generation to gemini now that we have it set up in mise settings. Would handle everything form the dates to the meals. Would need to figure out how to give it my dietary context each time though. Would ahve to tie in to whatever I'm using to determine my inventory to see what recipes are available though
- Add fi