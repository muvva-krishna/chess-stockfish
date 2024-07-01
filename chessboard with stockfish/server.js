const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'endgame.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'styles.css'));
  });

  app.get('/img/:piece', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'img' , req.params.piece));
  });
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
