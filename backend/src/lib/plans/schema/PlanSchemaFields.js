import { PlanStatuses } from '../enums/PlanEnums';

const PlanSchemaFields = {
  project_id: {
    bsonType: 'objectId',
  },
  instance_id: {
    bsonType: 'string',
  },
  title: {
    bsonType: 'string',
  },
  prompt: {
    bsonType: 'string',
  },
  content: {
    bsonType: 'string',
    minLength: 1,
  },
  status: {
    bsonType: 'string',
    enum: Object.values(PlanStatuses),
  },
};

export default PlanSchemaFields;
