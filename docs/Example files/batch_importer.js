const fs = require('fs');
const path = require('path');

const API_KEY = "e329d0e29600ddec2e25337421f1004e";
const VAULT_ROOT = path.resolve(__dirname, '../../');
const JSON_FILE_PATH = path.join(VAULT_ROOT, 'Life/Media/next-episode-export-thuban87.json');
const PROGRESS_FILE = path.join(__dirname, 'batch_progress.json');

// Helper for delays
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function searchTMDB(type, query) {
    try {
        const searchType = type === 'movie' ? 'movie' : 'tv';
        const url = `https://api.themoviedb.org/3/search/${searchType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.results && data.results.length > 0 ? data.results[0] : null;
    } catch (error) {
        return null;
    }
}

async function getDetails(type, id) {
    try {
        const searchType = type === 'movie' ? 'movie' : 'tv';
        const url = `https://api.themoviedb.org/3/${searchType}/${id}?api_key=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return {};
        return await res.json();
    } catch (error) {
        return {};
    }
}

async function processItem(item) {
    console.log(`Processing: ${item.name} (${item.type})...`);
    const searchResult = await searchTMDB(item.type, item.name);
    await delay(250);

    if (!searchResult) {
        console.error(`  Not found: ${item.name}`);
        return;
    }

    const details = await getDetails(item.type, searchResult.id);
    await delay(250);

    const title = (details.title || details.name).replace(/[:/\\|?*<>\"]/g, "");
    const year = (details.release_date || details.first_air_date || "").substring(0, 4);
    const poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : "";
    const summary = (details.overview || "").replace(/\n/g, " ");
    const genres = details.genres ? details.genres.map(g => g.name).join(", ") : "";
    const rating = details.vote_average ? details.vote_average.toFixed(1) : "";

    const subfolder = item.status === 'watched' ? 'Watched' : 'To Watch';
    const folderType = item.type === 'movie' ? 'Movies' : 'TV';
    const folderPath = path.join(VAULT_ROOT, 'Life', 'Media', folderType, subfolder);
    
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    const filePath = path.join(folderPath, `${title}.md`);

    const fileLines = [
        "---",
        `type: ${item.type === 'movie' ? "Movie" : "TV Show"}`,
        `genre: ${genres}`,
        `rating: ${rating}`,
        `release_year: ${year}`,
        `poster: "${poster}"`,
        "---",
        `# ${title}`,
        "",
        "## Summary",
        `> ${summary}`,
        "",
        "## Why I want to watch this",
        "- ",
        "",
        "## Notes/Review",
        "- ",
        ""
    ];

    const fileContent = fileLines.join("\n");

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, fileContent);
        console.log(`  Created: ${filePath}`);
    } else {
        console.log(`  Exists: ${title}`);
    }
}

async function main() {
    try {
        const rawData = fs.readFileSync(JSON_FILE_PATH, 'utf8');
        const data = JSON.parse(rawData);

        // Flatten all items into one list
        const allItems = [];
        if (data.movies) {
            data.movies.forEach(m => allItems.push({ type: 'movie', name: m.name, status: m.watched === 1 ? 'watched' : 'to-watch' }));
        }
        if (data.series) {
            data.series.forEach(s => allItems.push({ type: 'tv', name: s.name, status: 'watched' }));
        }

        // Load progress
        let startIndex = 0;
        if (fs.existsSync(PROGRESS_FILE)) {
            const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
            startIndex = progress.nextIndex || 0;
        }

        const batchSize = 30;
        const endIndex = Math.min(startIndex + batchSize, allItems.length);
        const batch = allItems.slice(startIndex, endIndex);

        console.log(`Starting Batch: Items ${startIndex} to ${endIndex - 1} (Total items: ${allItems.length})`);

        for (const item of batch) {
            await processItem(item);
        }

        // Save progress
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ nextIndex: endIndex }, null, 2));

        if (endIndex >= allItems.length) {
            console.log("All items processed. Progress file reset.");
            fs.unlinkSync(PROGRESS_FILE);
        } else {
            console.log(`Batch complete. Next index: ${endIndex}. Run script again for next batch.`);
        }

    } catch (err) {
        console.error("Error:", err);
    }
}

main();
