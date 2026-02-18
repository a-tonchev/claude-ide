import { useCallback } from 'react';

import UrlHelper from '@/components/connections/UrlHelper';
import useQueryValue from '@/components/connections/hooks/useQueryValue';

const useQueryState = (defaultValue, paramName = 'param', removeOnChange) => {
  const queryValue = useQueryValue(defaultValue, paramName);

  const changeParam = useCallback(value => {
    if (!value) {
      UrlHelper.deleteParam(paramName);
    } else {
      UrlHelper.setParam(paramName, value);
      if (removeOnChange) removeOnChange.forEach(p => UrlHelper.deleteParam(p));
    }
  }, [paramName, removeOnChange]);

  return [queryValue, changeParam];
};

export default useQueryState;
