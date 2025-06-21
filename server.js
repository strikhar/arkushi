const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/icons', express.static(path.join(__dirname, 'icons')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/poems', express.static(path.join(__dirname, 'poems')));


// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/poets', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'poets.html'));
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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
}); 