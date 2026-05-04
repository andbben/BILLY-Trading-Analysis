const env = require('./src/config/env');
const app = require('./src/app');

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
