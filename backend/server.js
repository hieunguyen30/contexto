require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const contentRouter = require('./routes/content');
const vocabRouter = require('./routes/vocab');
const chatRouter = require('./routes/chat');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'contexto-backend' });
});

app.use('/api/content', contentRouter);
app.use('/api/vocab', vocabRouter);
app.use('/api/chat', chatRouter);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Contexto backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
