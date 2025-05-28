// api/riverDetails.js
import { datastoreClient, RIVER_DETAILS_KIND } from '../../services/datastoreConnection';

export default async function handler(req, res) {
  const query = datastoreClient.createQuery(RIVER_DETAILS_KIND)

  try {
    const results = await datastoreClient.runQuery(query);
    const entities = results[0];
    res.status(200).json(entities);
  } catch (error) {
    console.error('riverDetails.js Datastore error:', error); // Server-side logging
    res.status(400).json({ error: `Error while fetching data for River Details | Datastore API Error Message: ${error}` });
  }
}