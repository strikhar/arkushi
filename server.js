const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const port = process.env.PORT || 3000;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/icons', express.static(path.join(__dirname, 'icons')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/poems', express.static(path.join(__dirname, 'poems')));

const poetsDir = path.join(__dirname, 'poems');

async function getPoetData(slug) {
    try {
        const authorPath = path.join(poetsDir, slug);
        const metadataPath = path.join(authorPath, 'metadata.json');
        const bioPath = path.join(authorPath, 'bio.txt');
        
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        
        const bio = await fs.readFile(bioPath, 'utf-8');

        const filesInDir = await fs.readdir(authorPath);
        const imageFile = filesInDir.find(file => file.startsWith('image.'));

        return {
            name: metadata.name,
            slug: slug,
            bio: bio,
            imageUrl: imageFile ? `/poems/${encodeURIComponent(slug)}/${imageFile}` : '/images/home/placeholder.png'
        };
    } catch (error) {
        console.error(`Could not load data for poet: ${slug}`, error);
        return null; // Return null if there's an error
    }
}

// HTML Page Routes
app.get('/', async (req, res) => {
    try {
        const poetFolders = (await fs.readdir(poetsDir, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        const totalPoets = poetFolders.length;

        const featuredPoetSlugs = ["Юрій Тарнавський", "Віра Вовк", "Євген Гребінка"];
        
        const featuredPoets = (await Promise.all(featuredPoetSlugs.map(getPoetData)))
            .filter(poet => poet !== null); // Filter out any poets that failed to load
        
        res.render('index', { featuredPoets, totalPoets });
    } catch (error) {
        console.error("Error loading homepage:", error);
        // Render the page with empty data to avoid crashing
        res.render('index', { featuredPoets: [], totalPoets: 0 });
    }
});

app.get('/poets', (req, res) => {
    res.render('poets');
});

app.get('/poets/:slug', async (req, res) => {
    try {
        const poetSlug = req.params.slug;
        const poetsDir = path.join(__dirname, 'poems');
        const authorPath = path.join(poetsDir, poetSlug);

        const metadataPath = path.join(authorPath, 'metadata.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);

        const bioPath = path.join(authorPath, 'bio.txt');
        const bio = await fs.readFile(bioPath, 'utf-8');

        const filesInDir = await fs.readdir(authorPath);
        const imageFile = filesInDir.find(file => file.startsWith('image.'));

        const collections = [];
        const authorSubDirs = await fs.readdir(authorPath, { withFileTypes: true });
        for (const dirent of authorSubDirs) {
            if (dirent.isDirectory()) {
                const collectionPath = path.join(authorPath, dirent.name);
                const poemFiles = await fs.readdir(collectionPath);
                const poems = poemFiles.map(file => ({
                    title: path.basename(file, '.txt').replace(/_/g, ' '),
                    url: `/poets/${encodeURIComponent(poetSlug)}/collections/${encodeURIComponent(dirent.name)}/${encodeURIComponent(path.basename(file, '.txt'))}`,
                }));
                collections.push({ name: dirent.name.replace(/_/g, ' '), poems });
            }
        }

        const poet = {
            ...metadata,
            slug: poetSlug,
            bio,
            imageUrl: imageFile ? `/poems/${poetSlug}/${imageFile}` : '/images/home/placeholder.png'
        };

        res.render('poet-detail', { poet, collections });
    } catch (error) {
        console.error("Error fetching poet details:", error);
        res.status(404).send("Poet not found");
    }
});

// API Routes
app.get('/api/poets', async (req, res) => {
    const poetsDir = path.join(__dirname, 'poems');
    try {
        const authorFolders = await fs.readdir(poetsDir);
        const poetsData = [];

        for (const authorFolder of authorFolders) {
            const authorPath = path.join(poetsDir, authorFolder);
            const stats = await fs.stat(authorPath);

            if (stats.isDirectory()) {
                const metadataPath = path.join(authorPath, 'metadata.json');
                try {
                    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                    const metadata = JSON.parse(metadataContent);
                    
                    const filesInDir = await fs.readdir(authorPath);
                    const imageFile = filesInDir.find(file => file.startsWith('image.'));
                    
                    poetsData.push({
                        slug: authorFolder,
                        firstName: metadata.firstName,
                        lastName: metadata.lastName,
                        birthYear: metadata.birthDate,
                        deathYear: metadata.deathDate,
                        imageUrl: imageFile ? `/poems/${authorFolder}/${imageFile}` : '/images/home/placeholder.png'
                    });
                } catch (e) {
                    // Could not read metadata.json or it doesn't exist, skip this folder.
                    console.error(`Could not process poet in ${authorFolder}:`, e.message);
                }
            }
        }
        res.json(poetsData);
    } catch (error) {
        res.status(500).json({ message: "Error reading poets directory", error: error.message });
    }
});

app.get('/poem/random', async (req, res) => {
    try {
        const poetsDir = path.join(__dirname, 'poems');
        const authorFolders = (await fs.readdir(poetsDir, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        const randomAuthor = authorFolders[Math.floor(Math.random() * authorFolders.length)];
        const authorPath = path.join(poetsDir, randomAuthor);

        const poemFiles = [];
        const items = await fs.readdir(authorPath, { withFileTypes: true });
        for (const item of items) {
            if (item.isDirectory()) {
                const files = await fs.readdir(path.join(authorPath, item.name));
                for (const file of files) {
                    if (file.endsWith('.txt')) {
                        poemFiles.push({
                            poet: randomAuthor,
                            collection: item.name,
                            poem: path.basename(file, '.txt')
                        });
                    }
                }
            }
        }

        if (poemFiles.length === 0) {
            return res.status(404).send('No poems found to select a random one.');
        }

        const randomPoem = poemFiles[Math.floor(Math.random() * poemFiles.length)];
        const poemUrl = `/poets/${encodeURIComponent(randomPoem.poet)}/collections/${encodeURIComponent(randomPoem.collection)}/${encodeURIComponent(randomPoem.poem)}`;
        
        res.redirect(poemUrl);
    } catch (error) {
        console.error('Error getting random poem:', error);
        res.status(500).send('Error getting random poem');
    }
});

app.get('/poets/:poetSlug/collections/:collectionSlug/:poemSlug', async (req, res) => {
    try {
        const { poetSlug, collectionSlug, poemSlug } = req.params;
        
        const decodedPoetSlug = decodeURIComponent(poetSlug);
        const decodedCollectionSlug = decodeURIComponent(collectionSlug);
        const decodedPoemSlug = decodeURIComponent(poemSlug);

        const poemPath = path.join(__dirname, 'poems', decodedPoetSlug, decodedCollectionSlug, `${decodedPoemSlug}.txt`);
        const poemContent = await fs.readFile(poemPath, 'utf-8');

        const metadataPath = path.join(__dirname, 'poems', decodedPoetSlug, 'metadata.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const poet = JSON.parse(metadataContent);

        res.render('poem-view', {
            poet: { ...poet, slug: decodedPoetSlug },
            collection: { name: decodedCollectionSlug, slug: decodedCollectionSlug },
            poem: {
                title: decodedPoemSlug.replace(/_/g, ' '),
                content: poemContent.split('\\n')
            }
        });

    } catch (error) {
        console.error('Error fetching poem:', error);
        res.status(404).send('Poem not found');
    }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
}); 