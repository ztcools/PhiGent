import { parseValue } from '../Insert';
import { CreateIndexCodeParam } from './Types';

// 用 replacer 把 extra param 从 JSON 还原为原始对象
const replacer = (key: string, value: any) => {
  if (typeof value === 'string') {
    return parseValue(value);
  }
  return value;
};

export const getCreateIndexPYCode = (params: CreateIndexCodeParam) => {
  const { collectionName, fieldName, indexName, extraParams, isScalarField } =
    params;
  const index_params = {
    ...extraParams,
    params: parseValue(extraParams.params),
  };
  const pyCode = `from pymilvus import Collection

collection = Collection('${collectionName}')

${
  isScalarField
    ? ''
    : `index_params = ${JSON.stringify(index_params, replacer, 4)}`
}

collection.create_index(
  field_name="${fieldName}",
  ${isScalarField ? '' : `index_params=index_params,`}
  index_name="${indexName}"
)
`;

  return pyCode;
};
