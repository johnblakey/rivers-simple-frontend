//TODO - take notes of connecting to the datastore with ADC locally
// return the data json async to the main.tc file to then create Lit
// UI elements


import { Datastore } from '@google-cloud/datastore';

const PROJECT_ID = process.env.PROJECT_ID;
const WATER_LEVEL_KIND = process.env.WATER_LEVEL_KIND;
const RIVER_DETAILS_KIND = process.env.RIVER_DETAILS_KIND;
const NAMESPACE = process.env.DATASTORE_NAMESPACE;

const datastoreClient = new Datastore({ projectId: PROJECT_ID, namespace: NAMESPACE });

export { datastoreClient, WATER_LEVEL_KIND, RIVER_DETAILS_KIND };


// utils.js
export const formatDate = (dateTime) => {
  const date = new Date(dateTime);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}-${day}-${year} ${hours}:${minutes}`;
};

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