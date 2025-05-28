// api/waterLevels.js
import { datastoreClient, WATER_LEVEL_KIND } from '../../services/datastoreConnection';

// TODO refactor using rep or remove
export default async function handler(req, res) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);

  const query = datastoreClient.createQuery(WATER_LEVEL_KIND)
    .filter('timestamp', '>=', startDate)
    .filter('timestamp', '<=', endDate)
    .order('timestamp', { descending: true });

  try {
    const results = await datastoreClient.runQuery(query);
    const entities = results[0];
    res.status(200).json(entities);
  } catch (error) {
    console.error('waterLevels.js Datastore error:', error); // Server-side logging
    res.status(400).json({ error: `Error while fetching data for Water Levels | Datastore API Error Message: ${error}` });
  }
}
