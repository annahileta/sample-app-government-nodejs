require('dotenv').config({ path: `${process.env.PWD}/.env` });
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const errorText = require('./assets/errorText.json').api;
const AppError = require('./utils/appError');

// Route imports
const authRouter = require('./routes/jwtRouter');
const passportRouter = require('./routes/passportRouter');
const loanRouter = require('./routes/loanRouter');
const trafficRouter = require('./routes/trafficRouter');

// Max session age
const maxSessionAge = 1000 * 60 * 60 * 24 * 1; // One day

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.CORS_ORIGIN || 'https://government.sampleapps.docusign.com']
    : ['http://localhost:3000'],
  credentials: true,
};

const app = express();
app.set('trust proxy', 1);
app
  .use(helmet())
  .use(bodyParser.json())
  .use(
    session({
      name: 'MyGovernmentApp',
      secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: maxSessionAge,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
    })
  );

app.use(cors(corsOptions));



app.get('/', (req, res) => {
  res.send('Server started');
  res.end();
});

if (process.env.NODE_ENV === 'development') {
  app.get('/check-session', (req, res) => {
    res.json({ isLoggedIn: req.session.isLoggedIn || false });
  });
}

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.isLoggedIn) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Routing
app.use('/auth', authRouter);
app.use('/passportApplication', requireAuth, passportRouter);
app.use('/loanApplication', requireAuth, loanRouter);
app.use('/trafficTicket', requireAuth, trafficRouter);

// Error handler
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    // AppError will contain a specific status code and custom message
    const statusCode = err.statusCode || 500;
    const errorMessage = err.message;

    res.status(statusCode).send({
      title: errorText.docusignApiError,
      description: `<b>Status code: ${statusCode}</b><br></br>${errorMessage}`,
    });
  } else if (err && err.response && err.response.body) {
    // Docusign API specific error, extract error code and message
    const statusCode = 500;
    const errorBody = err && err.response && err.response.body;
    const errorCode = errorBody && errorBody.errorCode;
    const errorMessage = errorBody && errorBody.message;

    res.status(statusCode).send({
      title: errorText.docusignApiError,
      description: `<b>Status code: ${statusCode}</b><br></br>${errorCode}: ${errorMessage}`,
    });
  } else {
    console.log('Unknown error occurred.');
    console.log(err);

    res.status(500).send({
      title: errorText.docusignApiError,
      description: `<b>Status code: ${statusCode}</b><br></br>${errorText.unknownError}`,
    });
  }
});



console.log('process.env.NODE_ENV', process.env.NODE_ENV)

// Serve static assets if in production
if (process.env.NODE_ENV === 'production') {
  console.log('Serving static assets from:', path.join(__dirname, 'assets', 'public'));
  app.use('/app/assets', express.static(path.join(__dirname, 'assets', 'public')));
}




const port = process.env.PORT_NUMBER;
console.log('port on server', port)
app.listen(port, '0.0.0.0', () => {
  console.log(`Server started and listening on port ${port}`);
});
