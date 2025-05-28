// services/datastoreConnection.js
import { Datastore } from '@google-cloud/datastore';

const PROJECT_ID = process.env.PROJECT_ID;
const WATER_LEVEL_KIND = process.env.WATER_LEVEL_KIND;
const RIVER_DETAILS_KIND = process.env.RIVER_DETAILS_KIND;
const NAMESPACE = process.env.DATASTORE_NAMESPACE;

const datastoreClient = new Datastore({ projectId: PROJECT_ID, namespace: NAMESPACE });

export { datastoreClient, WATER_LEVEL_KIND, RIVER_DETAILS_KIND };
