import 'dotenv/config';
import { app } from './app.js';
import { sequelize } from './database/sequelize.js';

const port = Number(process.env.PORT ?? 3000);

await sequelize.authenticate();
app.listen(port, () => {
  process.stdout.write(`API disponível em http://localhost:${port}/api/v1\n`);
});
