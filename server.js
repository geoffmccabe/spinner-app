// server.js
// This is a simple Express server primarily for serving the 'dist' folder
// if you run 'npm run build'. For development, 'npm run dev' uses Parcel's server.

const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'dist' directory (output of 'npm run build')
app.use(express.static(path.join(__dirname, 'dist')));

// All other routes serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log("If you ran 'npm run build', your app should be served from the 'dist' folder.");
  console.log("For development, it's recommended to use 'npm run dev' which uses Parcel's development server.");
});
