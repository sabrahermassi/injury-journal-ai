import app from './app.js';
import { PORT } from './config/port.js';

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
